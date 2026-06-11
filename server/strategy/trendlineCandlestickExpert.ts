import type { ProfessionalOpeningBar } from './trappedTraderDetector.js'
import type { TrendlineFailureSetupStatus } from './trendlineFailureSetup.js'

export type TrendlineCandlestickExpertBlocker =
  | 'BLOCKED_TRENDLINE_NOT_THREE_POINTS'
  | 'BLOCKED_TRENDLINE_ROLE_MISMATCH'
  | 'BLOCKED_TRENDLINE_DIRTY_GEOMETRY'
  | 'BLOCKED_NO_TRENDLINE_BREAK'
  | 'BLOCKED_BREAK_WICK_ONLY'
  | 'BLOCKED_NO_RETEST_FAILURE'
  | 'BLOCKED_RETEST_CANDLE_NOT_FAILED'
  | 'BLOCKED_CANDLE_CONTEXT_WEAK'

export type TrendlineCandlestickExpertStatus = {
  blockers: TrendlineCandlestickExpertBlocker[]
  candlestickConfirmationScore: number
  candleRead: string
  direction: 'LONG' | 'SHORT' | 'NONE'
  evidence: {
    anchorCount: number
    breakCandle: CandleSnapshot | null
    breakCloseDistance: number | null
    expectedTrendlineRole: 'RISING_SUPPORT' | 'FALLING_RESISTANCE' | null
    latestCandle: CandleSnapshot | null
    retestCandle: CandleSnapshot | null
    retestRejectDistance: number | null
    trendlineRole: 'RISING_SUPPORT' | 'FALLING_RESISTANCE' | null
  }
  mode: 'TRENDLINE_CANDLESTICK_EXPERT'
  nextCondition: string
  overallScore: number
  retestFailureScore: number
  status: 'CONFIRMED' | 'WAITING_BREAK' | 'WAITING_RETEST' | 'BLOCKED'
  timestamp: string
  trendlineQualityScore: number
  trendlineRead: string
}

type CandleSnapshot = {
  bodyRatio: number
  close: number
  high: number
  label: string
  low: number
  lowerWickRatio: number
  open: number
  timestamp: string
  upperWickRatio: number
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function validBars(bars: ProfessionalOpeningBar[]) {
  return bars
    .filter((bar) => [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
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

function candleLabel(bar: ProfessionalOpeningBar) {
  const body = bodyRatio(bar)
  const wick = wickRatios(bar)
  const bullish = bar.close > bar.open
  const bearish = bar.close < bar.open
  if (body <= 0.16) return 'DOJI_INDECISION'
  if (bearish && wick.upper >= 0.45) return 'BEARISH_UPPER_WICK_REJECTION'
  if (bullish && wick.lower >= 0.45) return 'BULLISH_LOWER_WICK_REJECTION'
  if (bullish && body >= 0.62) return 'STRONG_BULLISH_BODY'
  if (bearish && body >= 0.62) return 'STRONG_BEARISH_BODY'
  if (bullish) return 'BULLISH_BODY'
  if (bearish) return 'BEARISH_BODY'
  return 'NEUTRAL_CANDLE'
}

function snapshot(bar: ProfessionalOpeningBar | null | undefined): CandleSnapshot | null {
  if (!bar) return null
  const wick = wickRatios(bar)
  return {
    bodyRatio: round(bodyRatio(bar), 3),
    close: bar.close,
    high: bar.high,
    label: candleLabel(bar),
    low: bar.low,
    lowerWickRatio: round(wick.lower, 3),
    open: bar.open,
    timestamp: bar.timestamp,
    upperWickRatio: round(wick.upper, 3),
  }
}

function minutesBetween(left: string, right: string) {
  const start = Date.parse(left)
  const end = Date.parse(right)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1
  return Math.max(1, Math.abs(end - start) / 60_000)
}

function projectLine(input: {
  startPrice: number
  startTimestamp: string
  endPrice: number
  endTimestamp: string
  timestamp: string
}) {
  const start = Date.parse(input.startTimestamp)
  const end = Date.parse(input.endTimestamp)
  const target = Date.parse(input.timestamp)
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(target) || start === end) return input.endPrice
  const slope = (input.endPrice - input.startPrice) / minutesBetween(input.startTimestamp, input.endTimestamp)
  return input.startPrice + ((target - start) / 60_000) * slope
}

function averageRange(bars: ProfessionalOpeningBar[]) {
  const ranges = bars.map((bar) => bar.high - bar.low).filter((range) => Number.isFinite(range) && range > 0)
  return ranges.length ? ranges.reduce((sum, item) => sum + item, 0) / ranges.length : 1
}

function trendlineQuality(failure: TrendlineFailureSetupStatus | null) {
  const trendline = failure?.trendline
  if (!trendline) return 0
  let score = 0
  if ((trendline.anchorCount ?? 0) >= 3) score += 36
  if (trendline.anchors?.length === 3) score += 12
  score += Math.min(28, Math.max(0, trendline.qualityScore ?? 0) * 0.45)
  if (trendline.role === 'RISING_SUPPORT' || trendline.role === 'FALLING_RESISTANCE') score += 12
  if (Math.abs(trendline.slopePerMinute) > 0) score += 12
  return clamp(score)
}

function locateBreakAndRetest(input: {
  bars: ProfessionalOpeningBar[]
  direction: 'LONG' | 'SHORT'
  failure: TrendlineFailureSetupStatus
  tolerance: number
}) {
  const trendline = input.failure.trendline
  if (!trendline) return { breakBar: null, breakDistance: null, retestBar: null, retestDistance: null, wickOnlyBreak: false }
  const endIndex = input.bars.findIndex((bar) => bar.timestamp === trendline.endTimestamp)
  const afterEnd = input.bars.slice(Math.max(0, endIndex + 1))
  let wickOnlyBreak = false
  let breakBar: ProfessionalOpeningBar | null = null
  let breakDistance: number | null = null
  for (const bar of afterEnd) {
    const line = projectLine({
      endPrice: trendline.endPrice,
      endTimestamp: trendline.endTimestamp,
      startPrice: trendline.startPrice,
      startTimestamp: trendline.startTimestamp,
      timestamp: bar.timestamp,
    })
    if (input.direction === 'SHORT') {
      if (bar.low < line - input.tolerance && bar.close >= line - input.tolerance) wickOnlyBreak = true
      if (bar.close < line - input.tolerance) {
        breakBar = bar
        breakDistance = line - bar.close
        break
      }
    } else {
      if (bar.high > line + input.tolerance && bar.close <= line + input.tolerance) wickOnlyBreak = true
      if (bar.close > line + input.tolerance) {
        breakBar = bar
        breakDistance = bar.close - line
        break
      }
    }
  }
  if (!breakBar) return { breakBar, breakDistance, retestBar: null, retestDistance: null, wickOnlyBreak }

  const afterBreak = input.bars.slice(input.bars.findIndex((bar) => bar.timestamp === breakBar?.timestamp) + 1)
  let retestBar: ProfessionalOpeningBar | null = null
  let retestDistance: number | null = null
  for (const bar of afterBreak) {
    const line = projectLine({
      endPrice: trendline.endPrice,
      endTimestamp: trendline.endTimestamp,
      startPrice: trendline.startPrice,
      startTimestamp: trendline.startTimestamp,
      timestamp: bar.timestamp,
    })
    if (input.direction === 'SHORT' && bar.high >= line - input.tolerance && bar.close < line - input.tolerance) {
      retestBar = bar
      retestDistance = line - bar.close
      break
    }
    if (input.direction === 'LONG' && bar.low <= line + input.tolerance && bar.close > line + input.tolerance) {
      retestBar = bar
      retestDistance = bar.close - line
      break
    }
  }
  return { breakBar, breakDistance, retestBar, retestDistance, wickOnlyBreak }
}

function breakCandleScore(input: {
  bar: ProfessionalOpeningBar | null
  breakDistance: number | null
  direction: 'LONG' | 'SHORT'
  tolerance: number
}) {
  if (!input.bar) return 0
  const body = bodyRatio(input.bar)
  const bearish = input.bar.close < input.bar.open
  const bullish = input.bar.close > input.bar.open
  const range = Math.max(input.bar.high - input.bar.low, 0.00001)
  const closeLocation = input.direction === 'SHORT'
    ? (input.bar.close - input.bar.low) / range
    : (input.bar.high - input.bar.close) / range
  return clamp(
    25
    + Math.min(25, Math.max(0, input.breakDistance ?? 0) / Math.max(input.tolerance, 0.00001) * 8)
    + body * 24
    + (input.direction === 'SHORT' && bearish ? 18 : input.direction === 'LONG' && bullish ? 18 : 0)
    + (closeLocation <= 0.38 ? 14 : 0),
  )
}

function retestCandleScore(input: {
  bar: ProfessionalOpeningBar | null
  direction: 'LONG' | 'SHORT'
  retestDistance: number | null
  tolerance: number
}) {
  if (!input.bar) return 0
  const wick = wickRatios(input.bar)
  const bearish = input.bar.close < input.bar.open
  const bullish = input.bar.close > input.bar.open
  return clamp(
    30
    + Math.min(20, Math.max(0, input.retestDistance ?? 0) / Math.max(input.tolerance, 0.00001) * 7)
    + (input.direction === 'SHORT' ? wick.upper : wick.lower) * 28
    + (input.direction === 'SHORT' && bearish ? 12 : input.direction === 'LONG' && bullish ? 12 : 0)
    + bodyRatio(input.bar) * 10,
  )
}

export function analyzeTrendlineCandlestickExpert(input: {
  bars: ProfessionalOpeningBar[]
  direction: 'LONG' | 'SHORT'
  now?: Date
  toleranceBps?: number
  trendlineFailure: TrendlineFailureSetupStatus | null
}): TrendlineCandlestickExpertStatus {
  const bars = validBars(input.bars)
  const latest = bars.at(-1) ?? null
  const trendline = input.trendlineFailure?.trendline ?? null
  const expectedRole = input.direction === 'SHORT' ? 'RISING_SUPPORT' : 'FALLING_RESISTANCE'
  const blockers: TrendlineCandlestickExpertBlocker[] = []
  const tolerance = Math.max((latest?.close ?? 1) * ((input.toleranceBps ?? 2.5) / 10_000), averageRange(bars) * 0.025, 0.01)
  const trendlineScore = trendlineQuality(input.trendlineFailure)

  if (!trendline || (trendline.anchorCount ?? 0) < 3) blockers.push('BLOCKED_TRENDLINE_NOT_THREE_POINTS')
  if (trendline?.role && trendline.role !== expectedRole) blockers.push('BLOCKED_TRENDLINE_ROLE_MISMATCH')
  if (trendline && trendlineScore < 58) blockers.push('BLOCKED_TRENDLINE_DIRTY_GEOMETRY')

  const located = input.trendlineFailure && trendline
    ? locateBreakAndRetest({ bars, direction: input.direction, failure: input.trendlineFailure, tolerance })
    : { breakBar: null, breakDistance: null, retestBar: null, retestDistance: null, wickOnlyBreak: false }

  if (!located.breakBar) {
    blockers.push(located.wickOnlyBreak ? 'BLOCKED_BREAK_WICK_ONLY' : 'BLOCKED_NO_TRENDLINE_BREAK')
  }
  const breakScore = breakCandleScore({
    bar: located.breakBar,
    breakDistance: located.breakDistance,
    direction: input.direction,
    tolerance,
  })

  if (located.breakBar && !located.retestBar) blockers.push('BLOCKED_NO_RETEST_FAILURE')
  const retestScore = retestCandleScore({
    bar: located.retestBar,
    direction: input.direction,
    retestDistance: located.retestDistance,
    tolerance,
  })
  if (located.retestBar && retestScore < 64) blockers.push('BLOCKED_RETEST_CANDLE_NOT_FAILED')

  const candleScore = clamp(breakScore * 0.46 + retestScore * 0.54)
  if (located.breakBar && located.retestBar && candleScore < 68) blockers.push('BLOCKED_CANDLE_CONTEXT_WEAK')
  const overall = clamp(trendlineScore * 0.42 + candleScore * 0.40 + retestScore * 0.18)

  let status: TrendlineCandlestickExpertStatus['status'] = 'CONFIRMED'
  if (blockers.includes('BLOCKED_NO_TRENDLINE_BREAK') || blockers.includes('BLOCKED_BREAK_WICK_ONLY')) status = 'WAITING_BREAK'
  else if (blockers.includes('BLOCKED_NO_RETEST_FAILURE')) status = 'WAITING_RETEST'
  else if (blockers.length) status = 'BLOCKED'

  const candleRead = located.breakBar && located.retestBar
    ? `${input.direction} confirmado por vela de ruptura ${candleLabel(located.breakBar)} y retest ${candleLabel(located.retestBar)}.`
    : located.breakBar
      ? `La ruptura tiene cierre, pero falta vela de retest fallido; no basta romper la linea.`
      : located.wickOnlyBreak
        ? 'Solo hubo mecha atravesando la linea; falta cierre real de ruptura.'
        : 'Aun no hay vela cerrada rompiendo la trendline de 3 puntos.'
  const trendlineRead = trendline
    ? `${trendline.role === 'RISING_SUPPORT' ? 'Soporte alcista' : 'Resistencia bajista'} de 3 puntos, calidad ${round(trendlineScore)}.`
    : 'Aun no hay trendline de 3 puntos limpia.'
  const nextCondition = status === 'CONFIRMED'
    ? 'Trendline y velas confirman; pasar a caja rojo/verde y safety paper.'
    : status === 'WAITING_RETEST'
      ? 'Esperar que el precio intente recuperar la linea y falle con vela cerrada.'
      : status === 'WAITING_BREAK'
        ? 'Esperar cierre M1 real rompiendo la linea, no solo mecha.'
        : 'Esperar mejor calidad de linea/velas antes de permitir entrada.'

  return {
    blockers: [...new Set(blockers)],
    candlestickConfirmationScore: round(candleScore),
    candleRead,
    direction: input.direction,
    evidence: {
      anchorCount: trendline?.anchorCount ?? 0,
      breakCandle: snapshot(located.breakBar),
      breakCloseDistance: located.breakDistance === null ? null : round(located.breakDistance, 4),
      expectedTrendlineRole: expectedRole,
      latestCandle: snapshot(latest),
      retestCandle: snapshot(located.retestBar),
      retestRejectDistance: located.retestDistance === null ? null : round(located.retestDistance, 4),
      trendlineRole: trendline?.role ?? null,
    },
    mode: 'TRENDLINE_CANDLESTICK_EXPERT',
    nextCondition,
    overallScore: round(overall),
    retestFailureScore: round(retestScore),
    status,
    timestamp: (input.now ?? new Date()).toISOString(),
    trendlineQualityScore: round(trendlineScore),
    trendlineRead,
  }
}
