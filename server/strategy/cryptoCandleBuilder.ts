export type CryptoTimeframe = '5s' | '15s' | '1m' | '5m' | '15m'

export type CryptoCandle = {
  open: number
  high: number
  low: number
  close: number
  volume: number
  startTime: string
  endTime: string
  completed: boolean
}

const timeframeMs: Record<CryptoTimeframe, number> = {
  '5s': 5_000,
  '15s': 15_000,
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
}

const maxCandles = 500
const stores = new Map<string, Record<CryptoTimeframe, CryptoCandle[]>>()

function normalize(symbol: string) {
  return symbol.trim().toUpperCase()
}

function iso(ms: number) {
  return new Date(ms).toISOString()
}

function newStore() {
  return { '5s': [], '15s': [], '1m': [], '5m': [], '15m': [] } satisfies Record<CryptoTimeframe, CryptoCandle[]>
}

function store(symbol: string) {
  const key = normalize(symbol)
  const current = stores.get(key)
  if (current) return current
  const created = newStore()
  stores.set(key, created)
  return created
}

function update(candles: CryptoCandle[], timeframe: CryptoTimeframe, price: number, volume: number, timestampMs: number) {
  const bucket = timeframeMs[timeframe]
  const startMs = Math.floor(timestampMs / bucket) * bucket
  const endMs = startMs + bucket
  const previous = candles.at(-1)

  for (const candle of candles) {
    candle.completed = Date.now() >= new Date(candle.endTime).getTime()
  }

  if (previous && previous.startTime === iso(startMs)) {
    previous.close = price
    previous.high = Math.max(previous.high, price)
    previous.low = Math.min(previous.low, price)
    previous.volume = Number((previous.volume + volume).toFixed(8))
    previous.completed = Date.now() >= endMs
    return
  }

  candles.push({
    open: price,
    high: price,
    low: price,
    close: price,
    volume,
    startTime: iso(startMs),
    endTime: iso(endMs),
    completed: Date.now() >= endMs,
  })
  if (candles.length > maxCandles) candles.splice(0, candles.length - maxCandles)
}

export function recordCryptoTick(symbol: string, price: number, quantity = 0, timestampMs = Date.now()) {
  if (!Number.isFinite(price) || price <= 0) return
  const s = store(symbol)
  for (const timeframe of Object.keys(timeframeMs) as CryptoTimeframe[]) {
    update(s[timeframe], timeframe, price, Math.max(0, quantity), timestampMs)
  }
}

export function getCryptoCandles(symbol: string, timeframe: CryptoTimeframe, closedOnly = false) {
  const candles = [...store(symbol)[timeframe]]
  return closedOnly ? candles.filter((candle) => candle.completed) : candles
}

export function getCryptoCandleSummary(symbol: string) {
  const s = store(symbol)
  return Object.fromEntries((Object.keys(timeframeMs) as CryptoTimeframe[]).map((timeframe) => {
    const candles = s[timeframe]
    const closed = candles.filter((candle) => candle.completed)
    return [timeframe, {
      count: candles.length,
      closedCount: closed.length,
      enough: timeframe === '1m' ? closed.length >= 3 : timeframe === '5m' ? closed.length >= 1 : closed.length >= 3,
      lastClosedCandle: closed.at(-1)?.endTime ?? null,
    }]
  }))
}
