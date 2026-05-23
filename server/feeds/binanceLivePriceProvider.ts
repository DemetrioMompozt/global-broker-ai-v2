import { recordCryptoTick } from '../strategy/cryptoCandleBuilder.js'
import type { ProviderStatus } from './feedTypes.js'

type BinanceMessage = { data?: { a?: string; b?: string; p?: string; q?: string; s?: string; T?: number; u?: number } }

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
        if (data.data?.s && data.data.b && data.data.a) updateBook(data.data.s, data.data.b, data.data.a, data.data.u)
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
  return prices.get(symbol.toUpperCase())
}

export function getBinanceStatus() {
  return {
    status,
    lastError,
    lastUpdate: [...prices.values()].map((p) => p.lastPriceUpdate).sort().at(-1) ?? null,
    provider: activeProvider(),
    endpoint: activeHost(),
    symbols,
  }
}
