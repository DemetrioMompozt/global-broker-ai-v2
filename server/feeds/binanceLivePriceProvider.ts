import { recordCryptoTick } from '../strategy/cryptoCandleBuilder.js'
import type { ProviderStatus } from './feedTypes.js'

type BinanceMessage = { data?: { a?: string; b?: string; E?: number; p?: string; q?: string; s?: string; T?: number; u?: number } }

export type BinanceLivePrice = {
  symbol: string
  price: number
  previousPrice: number
  change: number
  changePercent: number
  bid?: number
  ask?: number
  spread?: number
  spreadBps?: number
  provider: 'Binance' | 'Binance.US'
  feedType: 'REALTIME_TICK'
  lastPriceUpdate: string
  connected: boolean
}

const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT']
const streamHosts = ['stream.binance.com:9443', 'stream.binance.us:9443'] as const
const prices = new Map<string, BinanceLivePrice>()
const rejectedTicks = new Map<string, { count: number; reason: string; lastRejectedAt: string }>()
let socket: WebSocket | undefined
let status: ProviderStatus = 'DISCONNECTED'
let started = false
let reconnectTimer: NodeJS.Timeout | undefined
let lastError: string | null = null
let hostIndex = 0

function activeHost() {
  return streamHosts[hostIndex] ?? streamHosts[0]
}

function activeProvider(): 'Binance' | 'Binance.US' {
  return activeHost().includes('binance.us') ? 'Binance.US' : 'Binance'
}

function streamUrl() {
  return `wss://${activeHost()}/stream?streams=${symbols.flatMap((s) => [`${s.toLowerCase()}@trade`, `${s.toLowerCase()}@bookTicker`]).join('/')}`
}

const priceBounds: Record<string, { min: number; max: number; maxSpreadBps: number }> = {
  BTCUSDT: { min: 1_000, max: 300_000, maxSpreadBps: 250 },
  ETHUSDT: { min: 100, max: 30_000, maxSpreadBps: 300 },
  SOLUSDT: { min: 1, max: 2_000, maxSpreadBps: 400 },
  XRPUSDT: { min: 0.05, max: 100, maxSpreadBps: 500 },
}

function rejectTick(symbol: string, reason: string) {
  const key = symbol.toUpperCase()
  const current = rejectedTicks.get(key)
  rejectedTicks.set(key, {
    count: (current?.count ?? 0) + 1,
    reason,
    lastRejectedAt: new Date().toISOString(),
  })
  lastError = `${key}: ${reason}`
}

export function isReasonableBinanceCryptoPrice(symbol: string, price: number) {
  const key = symbol.toUpperCase()
  const bounds = priceBounds[key]
  if (!Number.isFinite(price) || price <= 0) return false
  if (!bounds) return price < 1_000_000
  return price >= bounds.min && price <= bounds.max
}

export function isReasonableBinanceCryptoQuote(symbol: string, input: { price: number; bid?: number; ask?: number }, previousPrice?: number) {
  const key = symbol.toUpperCase()
  const bounds = priceBounds[key]
  if (!symbols.includes(key)) return { ok: false, reason: `Symbol ${key} is not in the Binance paper universe.` }
  if (!isReasonableBinanceCryptoPrice(key, input.price)) return { ok: false, reason: `Rejected impossible ${key} price ${input.price}.` }

  const hasBid = Number.isFinite(input.bid) && Number(input.bid) > 0
  const hasAsk = Number.isFinite(input.ask) && Number(input.ask) > 0
  if (hasBid || hasAsk) {
    const bid = Number(input.bid)
    const ask = Number(input.ask)
    if (!hasBid || !hasAsk || ask <= bid) return { ok: false, reason: `Rejected invalid ${key} bid/ask.` }
    if (!isReasonableBinanceCryptoPrice(key, bid) || !isReasonableBinanceCryptoPrice(key, ask)) {
      return { ok: false, reason: `Rejected impossible ${key} bid/ask ${bid}/${ask}.` }
    }
    const mid = (bid + ask) / 2
    const spreadBps = (ask - bid) / mid * 10_000
    const maxSpreadBps = bounds?.maxSpreadBps ?? 500
    if (!Number.isFinite(spreadBps) || spreadBps > maxSpreadBps) {
      return { ok: false, reason: `Rejected ${key} spread ${spreadBps.toFixed(2)} bps.` }
    }
  }

  if (Number.isFinite(previousPrice) && Number(previousPrice) > 0) {
    const jumpRatio = Math.abs(input.price / Number(previousPrice) - 1)
    if (jumpRatio > 0.25) return { ok: false, reason: `Rejected ${key} jump ${(jumpRatio * 100).toFixed(2)}%.` }
  }

  return { ok: true, reason: 'OK' }
}

function setPrice(symbol: string, input: {
  ask?: number
  bid?: number
  price: number
  quantity?: number
  time?: number
}) {
  const price = Number(input.price)
  if (!Number.isFinite(price) || price <= 0) return
  const bid = Number(input.bid)
  const ask = Number(input.ask)
  const hasBidAsk = Number.isFinite(bid) && bid > 0 && Number.isFinite(ask) && ask > bid
  const key = symbol.toUpperCase()
  const current = prices.get(key)
  const previous = current?.price ?? price
  const sanity = isReasonableBinanceCryptoQuote(key, { price, bid: hasBidAsk ? bid : undefined, ask: hasBidAsk ? ask : undefined }, current?.price)
  if (!sanity.ok) {
    rejectTick(key, sanity.reason)
    return
  }
  const nextBid = hasBidAsk ? bid : current?.bid
  const nextAsk = hasBidAsk ? ask : current?.ask
  const spread = nextBid && nextAsk ? nextAsk - nextBid : undefined
  const spreadBps = spread && price > 0 ? Number((spread / price * 10_000).toFixed(6)) : undefined
  prices.set(key, {
    symbol: key,
    price,
    previousPrice: previous,
    change: Number((price - previous).toFixed(8)),
    changePercent: previous > 0 ? Number(((price / previous - 1) * 100).toFixed(6)) : 0,
    bid: nextBid,
    ask: nextAsk,
    spread,
    spreadBps,
    provider: activeProvider(),
    feedType: 'REALTIME_TICK',
    lastPriceUpdate: new Date().toISOString(),
    connected: status === 'CONNECTED',
  })
  recordCryptoTick(key, price, Number(input.quantity ?? 0), input.time ?? Date.now())
}

function updateTrade(symbol: string, rawPrice: string | number | undefined, rawQuantity?: string | number, time?: number) {
  setPrice(symbol, { price: Number(rawPrice), quantity: Number(rawQuantity ?? 0), time })
}

function updateBook(symbol: string, rawBid: string | number | undefined, rawAsk: string | number | undefined, time?: number) {
  const bid = Number(rawBid)
  const ask = Number(rawAsk)
  if (!Number.isFinite(bid) || bid <= 0 || !Number.isFinite(ask) || ask <= bid) return
  setPrice(symbol, { ask, bid, price: (bid + ask) / 2, time })
}

function reconnect() {
  if (!started || reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined
    connect()
  }, 3000)
}

function connect() {
  status = 'CONNECTING'
  try {
    socket?.close()
    socket = new WebSocket(streamUrl())
    socket.addEventListener('open', () => {
      status = 'CONNECTED'
      lastError = null
      console.log(`[v2:binance] connected via ${activeProvider()}`, symbols.join(','))
    })
    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(String(event.data)) as BinanceMessage
        if (data.data?.s && data.data.p) updateTrade(data.data.s, data.data.p, data.data.q, data.data.T)
        if (data.data?.s && data.data.b && data.data.a) updateBook(data.data.s, data.data.b, data.data.a, data.data.E)
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    })
    socket.addEventListener('close', () => {
      status = 'DISCONNECTED'
      reconnect()
    })
    socket.addEventListener('error', () => {
      status = 'ERROR'
      const failedProvider = activeProvider()
      lastError = `${failedProvider} WebSocket error`
      hostIndex = (hostIndex + 1) % streamHosts.length
      reconnect()
    })
  } catch (error) {
    status = 'ERROR'
    lastError = error instanceof Error ? error.message : String(error)
    hostIndex = (hostIndex + 1) % streamHosts.length
    reconnect()
  }
}

export function startBinanceLivePriceProvider() {
  if (started) return
  started = true
  connect()
}

export function stopBinanceLivePriceProvider() {
  started = false
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = undefined
  socket?.close()
  socket = undefined
  status = 'DISCONNECTED'
}

export function getBinanceLivePrice(symbol: string) {
  const key = symbol.toUpperCase()
  const tick = prices.get(key)
  if (!tick) return undefined
  const sanity = isReasonableBinanceCryptoQuote(key, { price: tick.price, bid: tick.bid, ask: tick.ask }, tick.previousPrice)
  if (!sanity.ok) {
    rejectTick(key, sanity.reason)
    prices.delete(key)
    return undefined
  }
  return tick
}

export function getBinanceStatus() {
  return {
    status,
    lastError,
    lastUpdate: [...prices.values()].map((p) => p.lastPriceUpdate).sort().at(-1) ?? null,
    provider: activeProvider(),
    endpoint: activeHost(),
    symbols,
    rejectedTicks: Object.fromEntries(rejectedTicks),
  }
}
