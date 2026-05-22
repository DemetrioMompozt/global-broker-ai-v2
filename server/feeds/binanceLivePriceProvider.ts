import { recordCryptoTick } from '../strategy/cryptoCandleBuilder.js'
import type { ProviderStatus } from './feedTypes.js'

type BinanceMessage = { data?: { p?: string; q?: string; s?: string; T?: number } }

export type BinanceLivePrice = {
  symbol: string
  price: number
  previousPrice: number
  change: number
  changePercent: number
  provider: 'Binance'
  feedType: 'REALTIME_TICK'
  lastPriceUpdate: string
  connected: boolean
}

const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT']
const prices = new Map<string, BinanceLivePrice>()
let socket: WebSocket | undefined
let status: ProviderStatus = 'DISCONNECTED'
let started = false
let reconnectTimer: NodeJS.Timeout | undefined
let lastError: string | null = null

function streamUrl() {
  return `wss://stream.binance.com:9443/stream?streams=${symbols.map((s) => `${s.toLowerCase()}@trade`).join('/')}`
}

function update(symbol: string, rawPrice: string | number | undefined, rawQuantity?: string | number, time?: number) {
  const price = Number(rawPrice)
  if (!Number.isFinite(price) || price <= 0) return
  const key = symbol.toUpperCase()
  const previous = prices.get(key)?.price ?? price
  prices.set(key, {
    symbol: key,
    price,
    previousPrice: previous,
    change: Number((price - previous).toFixed(8)),
    changePercent: previous > 0 ? Number(((price / previous - 1) * 100).toFixed(6)) : 0,
    provider: 'Binance',
    feedType: 'REALTIME_TICK',
    lastPriceUpdate: new Date().toISOString(),
    connected: status === 'CONNECTED',
  })
  recordCryptoTick(key, price, Number(rawQuantity ?? 0), time ?? Date.now())
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
      console.log('[v2:binance] connected', symbols.join(','))
    })
    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(String(event.data)) as BinanceMessage
        if (data.data?.s && data.data.p) update(data.data.s, data.data.p, data.data.q, data.data.T)
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
      lastError = 'Binance WebSocket error'
      reconnect()
    })
  } catch (error) {
    status = 'ERROR'
    lastError = error instanceof Error ? error.message : String(error)
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
    symbols,
  }
}
