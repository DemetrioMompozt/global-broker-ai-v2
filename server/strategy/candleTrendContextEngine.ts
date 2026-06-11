import type { ProfessionalOpeningBar } from './trappedTraderDetector.js'
import type { TraderVideoReplicationStatus } from './traderVideoReplicationMode.js'

export type CandleTrendContextStatus = {
  barsAnalyzed: number
  blockReasons: string[]
  candleStory: string
  contextConfidence: number
  lastPattern:
    | 'BULLISH_BODY'
    | 'BEARISH_BODY'
    | 'DOJI_INDECISION'
    | 'UPPER_WICK_REJECTION'
    | 'LOWER_WICK_REJECTION'
    | 'BULLISH_ENGULFING'
    | 'BEARISH_ENGULFING'
    | 'INSIDE_COMPRESSION'
    | 'OUTSIDE_EXPANSION'
    | 'INSUFFICIENT_CANDLES'
  mode: 'CANDLE_TREND_CONTEXT_ENGINE'
  principlesApplied: string[]
  rangeCompression: boolean
  supportsVideoLong: boolean
  supportsVideoShort: boolean
  timestamp: string
  trendDirection: 'UPTREND' | 'DOWNTREND' | 'RANGE' | 'TRANSITION' | 'UNKNOWN'
  trendQuality: number
  trendStructure: {
    higherHighs: number
    higherLows: number
    lowerHighs: number
    lowerLows: number
    overlapRatio: number
  }
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function validBars(bars: ProfessionalOpeningBar[]) {
  return bars.filter((bar) => [bar.open, bar.high, bar.low, bar.close].every((value) => Number.isFinite(value) && value > 0))
}

function avg(values: number[]) {
  return values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0
}

function bodyRatio(bar: ProfessionalOpeningBar) {
  const range = Math.max(bar.high - bar.low, Math.abs(bar.close) * 0.00001)
  return Math.abs(bar.close - bar.open) / range
}

function wickRatios(bar: ProfessionalOpeningBar) {
  const range = Math.max(bar.high - bar.low, Math.abs(bar.close) * 0.00001)
  return {
    lower: (Math.min(bar.open, bar.close) - bar.low) / range,
    upper: (bar.high - Math.max(bar.open, bar.close)) / range,
  }
}

function structure(bars: ProfessionalOpeningBar[]) {
  let higherHighs = 0
  let higherLows = 0
  let lowerHighs = 0
  let lowerLows = 0
  let overlaps = 0
  for (let index = 1; index < bars.length; index += 1) {
    const current = bars[index]
    const previous = bars[index - 1]
    if (current.high > previous.high) higherHighs += 1
    if (current.low > previous.low) higherLows += 1
    if (current.high < previous.high) lowerHighs += 1
    if (current.low < previous.low) lowerLows += 1
    if (current.low <= previous.high && current.high >= previous.low) overlaps += 1
  }
  return {
    higherHighs,
    higherLows,
    lowerHighs,
    lowerLows,
    overlapRatio: bars.length > 1 ? overlaps / (bars.length - 1) : 0,
  }
}

function candlePattern(bars: ProfessionalOpeningBar[]): CandleTrendContextStatus['lastPattern'] {
  if (bars.length < 3) return 'INSUFFICIENT_CANDLES'
  const last = bars.at(-1)!
  const previous = bars.at(-2)!
  const br = bodyRatio(last)
  const wicks = wickRatios(last)
  const bullish = last.close > last.open
  const bearish = last.close < last.open
  const inside = last.high <= previous.high && last.low >= previous.low
  const outside = last.high > previous.high && last.low < previous.low
  if (bullish && previous.close < previous.open && last.close > previous.open && last.open < previous.close) return 'BULLISH_ENGULFING'
  if (bearish && previous.close > previous.open && last.close < previous.open && last.open > previous.close) return 'BEARISH_ENGULFING'
  if (wicks.upper >= 0.45 && bearish) return 'UPPER_WICK_REJECTION'
  if (wicks.lower >= 0.45 && bullish) return 'LOWER_WICK_REJECTION'
  if (inside && br <= 0.35) return 'INSIDE_COMPRESSION'
  if (outside && br >= 0.45) return 'OUTSIDE_EXPANSION'
  if (br <= 0.18) return 'DOJI_INDECISION'
  if (bullish) return 'BULLISH_BODY'
  if (bearish) return 'BEARISH_BODY'
  return 'DOJI_INDECISION'
}

function trendDirection(bars: ProfessionalOpeningBar[], s: ReturnType<typeof structure>) {
  if (bars.length < 8) return 'UNKNOWN' as const
  const closes = bars.map((bar) => bar.close)
  const first = avg(closes.slice(0, Math.max(2, Math.floor(closes.length * 0.35))))
  const last = avg(closes.slice(-Math.max(2, Math.floor(closes.length * 0.35))))
  const ranges = bars.map((bar) => Math.max(bar.high - bar.low, 0))
  const avgRange = avg(ranges)
  const net = last - first
  const strongUp = net > avgRange * 1.2 && s.higherHighs >= s.lowerHighs && s.higherLows >= s.lowerLows
  const strongDown = net < -avgRange * 1.2 && s.lowerHighs >= s.higherHighs && s.lowerLows >= s.higherLows
  if (strongUp) return 'UPTREND' as const
  if (strongDown) return 'DOWNTREND' as const
  if (Math.abs(net) <= avgRange * 0.8 || s.overlapRatio >= 0.82) return 'RANGE' as const
  return 'TRANSITION' as const
}

function keyLevelInteraction(status: TraderVideoReplicationStatus) {
  const trapped = status.wrongSidedTrader?.trappedSide ?? status.weakCountermoveTrendline?.trappedSide ?? 'NONE'
  return {
    buyersTrapped: trapped === 'BUYERS',
    sellersTrapped: trapped === 'SELLERS',
    hasOpeningRange: status.openingRange.state === 'OPENING_RANGE_COMPLETED',
  }
}

export function analyzeCandleTrendContext(input: {
  bars?: ProfessionalOpeningBar[]
  now?: Date
  status: TraderVideoReplicationStatus
}): CandleTrendContextStatus {
  const bars = validBars(input.bars ?? []).slice(-40)
  const timestamp = (input.now ?? new Date()).toISOString()
  const principlesApplied = [
    'Una vela aislada no confirma trade; necesita tendencia previa, ubicacion y confirmacion.',
    'La tendencia se lee por estructura: maximos/minimos, continuidad y solapamiento.',
    'Las mechas importan solo en niveles relevantes: rechazo arriba favorece short; rechazo abajo favorece long.',
    'Compresion y solapamiento sugieren contramovimiento debil; expansion con cierre confirma decision.',
    'El metodo del video tiene prioridad: marcas, atrapados, trendline de tres puntos, retest fallido y R/R 1:2.',
  ]
  if (bars.length < 8) {
    return {
      barsAnalyzed: bars.length,
      blockReasons: ['BLOCKED_INSUFFICIENT_CANDLE_CONTEXT'],
      candleStory: `Faltan velas para leer tendencia y contexto japones (${bars.length}/8).`,
      contextConfidence: 0,
      lastPattern: 'INSUFFICIENT_CANDLES',
      mode: 'CANDLE_TREND_CONTEXT_ENGINE',
      principlesApplied,
      rangeCompression: false,
      supportsVideoLong: false,
      supportsVideoShort: false,
      timestamp,
      trendDirection: 'UNKNOWN',
      trendQuality: 0,
      trendStructure: { higherHighs: 0, higherLows: 0, lowerHighs: 0, lowerLows: 0, overlapRatio: 0 },
    }
  }

  const s = structure(bars)
  const direction = trendDirection(bars, s)
  const pattern = candlePattern(bars)
  const bodyStrength = avg(bars.slice(-6).map(bodyRatio)) * 100
  const rangeCompression = s.overlapRatio >= 0.78 || pattern === 'INSIDE_COMPRESSION'
  const quality = clamp(
    (direction === 'UPTREND' || direction === 'DOWNTREND' ? 38 : direction === 'TRANSITION' ? 24 : 12)
    + Math.min(24, bodyStrength * 0.24)
    + (rangeCompression ? 12 : 0)
    + (pattern.includes('REJECTION') || pattern.includes('ENGULFING') ? 18 : 0)
    - (pattern === 'DOJI_INDECISION' ? 12 : 0),
  )
  const interaction = keyLevelInteraction(input.status)
  const supportsVideoShort = interaction.buyersTrapped
    && (direction === 'DOWNTREND' || direction === 'TRANSITION' || rangeCompression)
    && ['BEARISH_BODY', 'BEARISH_ENGULFING', 'UPPER_WICK_REJECTION', 'OUTSIDE_EXPANSION'].includes(pattern)
  const supportsVideoLong = interaction.sellersTrapped
    && (direction === 'UPTREND' || direction === 'TRANSITION' || rangeCompression)
    && ['BULLISH_BODY', 'BULLISH_ENGULFING', 'LOWER_WICK_REJECTION', 'OUTSIDE_EXPANSION'].includes(pattern)
  const blockReasons: string[] = []
  if (!interaction.hasOpeningRange) blockReasons.push('BLOCKED_NO_OPENING_RANGE_CONTEXT')
  if (!interaction.buyersTrapped && !interaction.sellersTrapped) blockReasons.push('BLOCKED_NO_TRAPPED_SIDE_FOR_CANDLE_CONTEXT')
  if (pattern === 'DOJI_INDECISION') blockReasons.push('BLOCKED_CANDLE_INDECISION')
  if (direction === 'RANGE' && !rangeCompression) blockReasons.push('BLOCKED_RANGE_WITHOUT_CLEAR_REJECTION')

  const candleStory = supportsVideoShort
    ? `Velas apoyan short: ${pattern}, compradores atrapados y tendencia/contexto ${direction}.`
    : supportsVideoLong
      ? `Velas apoyan long: ${pattern}, vendedores atrapados y tendencia/contexto ${direction}.`
      : `Velas aun no apoyan entrada del video: ${pattern}, tendencia ${direction}, solapamiento ${(s.overlapRatio * 100).toFixed(0)}%.`

  return {
    barsAnalyzed: bars.length,
    blockReasons,
    candleStory,
    contextConfidence: Math.round(quality),
    lastPattern: pattern,
    mode: 'CANDLE_TREND_CONTEXT_ENGINE',
    principlesApplied,
    rangeCompression,
    supportsVideoLong,
    supportsVideoShort,
    timestamp,
    trendDirection: direction,
    trendQuality: Math.round(quality),
    trendStructure: {
      higherHighs: s.higherHighs,
      higherLows: s.higherLows,
      lowerHighs: s.lowerHighs,
      lowerLows: s.lowerLows,
      overlapRatio: Number(s.overlapRatio.toFixed(3)),
    },
  }
}
