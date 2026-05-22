import { getCryptoCandles, type CryptoCandle, type CryptoTimeframe } from './cryptoCandleBuilder.js'

export type CandleBehaviorSignal = 'CONFIRMS_ENTRY' | 'BLOCKS_ENTRY' | 'NEUTRAL'

export type CandleBehaviorReadout = {
  available: boolean
  signal: CandleBehaviorSignal
  score: number
  pattern: string
  reason: string
  timeframe: '5s' | '15s' | '1m'
  bodyRatio: number
  directionAligned: boolean
  trendAligned: boolean
  breakoutConfirmed: boolean
  rejectionConfirmed: boolean
  exhaustionAgainst: boolean
  candlesUsed: number
}

type CandleStore = Record<CryptoTimeframe, CryptoCandle[]>

const timeframeMs: Record<CryptoTimeframe, number> = {
  '5s': 5_000,
  '15s': 15_000,
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
}

const cfdStores = new Map<string, CandleStore>()
const maxCandles = 500

function emptyStore(): CandleStore {
  return { '5s': [], '15s': [], '1m': [], '5m': [], '15m': [] }
}

function store(symbol: string) {
  const key = symbol.toUpperCase()
  const current = cfdStores.get(key)
  if (current) return current
  const created = emptyStore()
  cfdStores.set(key, created)
  return created
}

function iso(ms: number) {
  return new Date(ms).toISOString()
}

function update(candles: CryptoCandle[], timeframe: CryptoTimeframe, price: number, timestampMs: number) {
  const bucket = timeframeMs[timeframe]
  const startMs = Math.floor(timestampMs / bucket) * bucket
  const endMs = startMs + bucket
  const previous = candles.at(-1)
  for (const candle of candles) candle.completed = Date.now() >= new Date(candle.endTime).getTime()
  if (previous && previous.startTime === iso(startMs)) {
    previous.close = price
    previous.high = Math.max(previous.high, price)
    previous.low = Math.min(previous.low, price)
    previous.completed = Date.now() >= endMs
    return
  }
  candles.push({ completed: Date.now() >= endMs, close: price, endTime: iso(endMs), high: price, low: price, open: price, startTime: iso(startMs), volume: 0 })
  if (candles.length > maxCandles) candles.splice(0, candles.length - maxCandles)
}

export function recordCfdCandleTick(symbol: string, price: number, timestampMs = Date.now()) {
  if (!Number.isFinite(price) || price <= 0) return
  const s = store(symbol)
  for (const timeframe of Object.keys(timeframeMs) as CryptoTimeframe[]) update(s[timeframe], timeframe, price, timestampMs)
}

function getCandles(symbol: string, source: 'BINANCE_REALTIME' | 'VT_MARKETS_MT5_DEMO', timeframe: CryptoTimeframe) {
  if (source === 'BINANCE_REALTIME') return getCryptoCandles(symbol, timeframe, true)
  return [...store(symbol)[timeframe]].filter((candle) => candle.completed)
}

function candleDirection(candle: CryptoCandle): 'LONG' | 'SHORT' | 'FLAT' {
  if (candle.close > candle.open) return 'LONG'
  if (candle.close < candle.open) return 'SHORT'
  return 'FLAT'
}

function anatomy(candle: CryptoCandle, direction: 'LONG' | 'SHORT') {
  const range = Math.max(0, candle.high - candle.low)
  const body = Math.abs(candle.close - candle.open)
  const upperWick = candle.high - Math.max(candle.open, candle.close)
  const lowerWick = Math.min(candle.open, candle.close) - candle.low
  const bodyRatio = range > 0 ? body / range : 0
  const rejectionConfirmed = direction === 'LONG'
    ? lowerWick > body * 1.2 && candle.close >= candle.open
    : upperWick > body * 1.2 && candle.close <= candle.open
  const exhaustionAgainst = direction === 'LONG'
    ? upperWick > body * 2 && candle.close < candle.high - range * 0.35
    : lowerWick > body * 2 && candle.close > candle.low + range * 0.35
  return { body, bodyRatio, exhaustionAgainst, lowerWick, range, rejectionConfirmed, upperWick }
}

function evaluate(candles: CryptoCandle[], direction: 'LONG' | 'SHORT', timeframe: CandleBehaviorReadout['timeframe']): CandleBehaviorReadout {
  const recent = candles.slice(-6)
  if (recent.length < 3) {
    return {
      available: false,
      bodyRatio: 0,
      breakoutConfirmed: false,
      candlesUsed: recent.length,
      directionAligned: false,
      exhaustionAgainst: false,
      pattern: 'INSUFFICIENT_CANDLES',
      reason: `Faltan velas cerradas (${recent.length}/3) para leer comportamiento.`,
      rejectionConfirmed: false,
      score: 50,
      signal: 'NEUTRAL',
      timeframe,
      trendAligned: false,
    }
  }
  const last = recent.at(-1)!
  const previous = recent.slice(0, -1)
  const closes = recent.map((candle) => candle.close)
  const directionAligned = candleDirection(last) === direction
  const trendAligned = direction === 'LONG'
    ? closes.at(-1)! > closes[0] && closes.slice(1).filter((close, index) => close > closes[index]).length >= 3
    : closes.at(-1)! < closes[0] && closes.slice(1).filter((close, index) => close < closes[index]).length >= 3
  const previousHigh = Math.max(...previous.map((candle) => candle.high))
  const previousLow = Math.min(...previous.map((candle) => candle.low))
  const breakoutConfirmed = direction === 'LONG' ? last.close > previousHigh : last.close < previousLow
  const a = anatomy(last, direction)
  const compression = previous.length >= 3
    ? previous.slice(-3).reduce((sum, candle) => sum + Math.max(0, candle.high - candle.low), 0) / 3 < Math.max(0, last.high - last.low) * 0.8
    : false
  const falseBreak = direction === 'LONG'
    ? last.high > previousHigh && last.close < previousHigh
    : last.low < previousLow && last.close > previousLow
  const confirms = directionAligned && !a.exhaustionAgainst && (breakoutConfirmed || trendAligned || a.rejectionConfirmed) && a.bodyRatio >= 0.35
  const blocks = falseBreak || a.exhaustionAgainst || (!directionAligned && a.bodyRatio >= 0.45)
  const score = Math.max(0, Math.min(100,
    55
    + (directionAligned ? 12 : -12)
    + (trendAligned ? 12 : 0)
    + (breakoutConfirmed ? 14 : 0)
    + (a.rejectionConfirmed ? 10 : 0)
    + (compression && breakoutConfirmed ? 8 : 0)
    - (a.exhaustionAgainst ? 18 : 0)
    - (falseBreak ? 22 : 0)
    + Math.min(10, a.bodyRatio * 12)
  ))
  const pattern = falseBreak
    ? 'FAILED_BREAKOUT'
    : a.exhaustionAgainst
      ? 'EXHAUSTION_WICK_AGAINST'
      : breakoutConfirmed && compression
        ? 'COMPRESSION_BREAKOUT'
        : breakoutConfirmed
          ? 'CLOSE_BREAKOUT'
          : a.rejectionConfirmed
            ? 'REJECTION_CANDLE'
            : trendAligned
              ? 'TREND_CONTINUATION'
              : directionAligned
                ? 'DIRECTIONAL_BODY'
                : 'OPPOSITE_BODY'
  return {
    available: true,
    bodyRatio: Number(a.bodyRatio.toFixed(4)),
    breakoutConfirmed,
    candlesUsed: recent.length,
    directionAligned,
    exhaustionAgainst: a.exhaustionAgainst,
    pattern,
    reason: `${pattern}: ${timeframe}, cuerpo ${(a.bodyRatio * 100).toFixed(0)}%, tendencia ${trendAligned ? 'alineada' : 'no alineada'}, breakout ${breakoutConfirmed ? 'confirmado' : 'no'}, rechazo ${a.rejectionConfirmed ? 'si' : 'no'}.`,
    rejectionConfirmed: a.rejectionConfirmed,
    score: Number(score.toFixed(1)),
    signal: confirms ? 'CONFIRMS_ENTRY' : blocks ? 'BLOCKS_ENTRY' : 'NEUTRAL',
    timeframe,
    trendAligned,
  }
}

export function evaluateCandleBehavior(symbol: string, source: 'BINANCE_REALTIME' | 'VT_MARKETS_MT5_DEMO', direction: 'LONG' | 'SHORT') {
  const timeframes: Array<CandleBehaviorReadout['timeframe']> = ['1m', '15s', '5s']
  const readouts = timeframes.map((timeframe) => evaluate(getCandles(symbol, source, timeframe), direction, timeframe))
  const available = readouts.find((item) => item.available && item.signal !== 'NEUTRAL') ?? readouts.find((item) => item.available) ?? readouts[0]
  return available
}
