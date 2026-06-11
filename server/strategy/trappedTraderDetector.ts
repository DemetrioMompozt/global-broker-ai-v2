export type OpeningLevelName =
  | 'openingRangeHigh'
  | 'openingRangeLow'
  | 'overnightHigh'
  | 'overnightLow'
  | 'previousDayHigh'
  | 'previousDayLow'

export type ProfessionalOpeningBar = {
  close: number
  high: number
  low: number
  open: number
  timestamp: string
  volume?: number | null
}

export type ProfessionalOpeningLevels = {
  openingRangeHigh: number | null
  openingRangeLow: number | null
  overnightHigh: number | null
  overnightLow: number | null
  previousDayClose: number | null
  previousDayHigh: number | null
  previousDayLow: number | null
  sessionHigh: number | null
  sessionLow: number | null
}

export type TrappedTraderResult = {
  confidence: number
  confirmationStrength: number
  failedLevel: OpeningLevelName | null
  failedLevelPrice: number | null
  likelyStopZone: number | null
  reason: string
  reclaimOrRejectPrice: number | null
  trapType: 'BULL_TRAP' | 'BEAR_TRAP' | 'NONE'
  trappedSide: 'BUYERS' | 'SELLERS' | 'NONE'
}

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function rangeOf(bars: ProfessionalOpeningBar[]) {
  const highs = bars.map((bar) => bar.high).filter(Number.isFinite)
  const lows = bars.map((bar) => bar.low).filter(Number.isFinite)
  if (!highs.length || !lows.length) return 0
  return Math.max(...highs) - Math.min(...lows)
}

function candidateLevels(
  levels: ProfessionalOpeningLevels,
  side: 'ABOVE' | 'BELOW',
): Array<{ name: OpeningLevelName; price: number }> {
  const names: OpeningLevelName[] = side === 'ABOVE'
    ? ['openingRangeHigh', 'overnightHigh', 'previousDayHigh']
    : ['openingRangeLow', 'overnightLow', 'previousDayLow']
  return names
    .map((name) => ({ name, price: levels[name] }))
    .filter((item): item is { name: OpeningLevelName; price: number } => finite(item.price))
}

export function detectTrappedTraders(input: {
  bars: ProfessionalOpeningBar[]
  levels: ProfessionalOpeningLevels
  toleranceBps?: number
}): TrappedTraderResult {
  const bars = input.bars.filter((bar) => [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite))
  const latest = bars.at(-1)
  if (!latest || bars.length < 2) {
    return {
      confidence: 0,
      confirmationStrength: 0,
      failedLevel: null,
      failedLevelPrice: null,
      likelyStopZone: null,
      reason: 'No hay suficientes velas posteriores al opening range para detectar compradores/vendedores atrapados.',
      reclaimOrRejectPrice: null,
      trapType: 'NONE',
      trappedSide: 'NONE',
    }
  }

  const totalRange = rangeOf(bars)
  const toleranceMultiplier = (input.toleranceBps ?? 1.5) / 10_000
  const bullCandidates = candidateLevels(input.levels, 'ABOVE')
  const bearCandidates = candidateLevels(input.levels, 'BELOW')

  let bestBull: TrappedTraderResult | null = null
  for (const level of bullCandidates) {
    const tolerance = Math.max(level.price * toleranceMultiplier, totalRange * 0.03)
    const breakIndex = bars.findIndex((bar) => bar.high > level.price + tolerance)
    if (breakIndex < 0) continue
    const afterBreak = bars.slice(breakIndex)
    const failed = afterBreak.some((bar) => bar.close < level.price - tolerance)
    if (!failed || latest.close >= level.price) continue
    const maxExcursion = Math.max(...afterBreak.map((bar) => bar.high)) - level.price
    const rejectDepth = level.price - latest.close
    const redBody = Math.max(0, latest.open - latest.close)
    const latestRange = Math.max(latest.high - latest.low, Math.abs(latest.close) * 0.00001)
    const confirmationStrength = clamp(
      (maxExcursion / Math.max(tolerance, 0.00001)) * 20
      + (rejectDepth / Math.max(tolerance, 0.00001)) * 20
      + (redBody / latestRange) * 40,
    )
    const confidence = clamp(confirmationStrength * 0.85 + Math.min(15, afterBreak.length * 2))
    const result: TrappedTraderResult = {
      confidence,
      confirmationStrength,
      failedLevel: level.name,
      failedLevelPrice: level.price,
      likelyStopZone: Math.max(...afterBreak.map((bar) => bar.high)) + tolerance,
      reason: `BULL_TRAP: precio rompio ${level.name} y volvio debajo; compradores quedan atrapados sobre ${level.price}.`,
      reclaimOrRejectPrice: latest.close,
      trapType: 'BULL_TRAP',
      trappedSide: 'BUYERS',
    }
    if (!bestBull || result.confidence > bestBull.confidence) bestBull = result
  }

  let bestBear: TrappedTraderResult | null = null
  for (const level of bearCandidates) {
    const tolerance = Math.max(level.price * toleranceMultiplier, totalRange * 0.03)
    const breakIndex = bars.findIndex((bar) => bar.low < level.price - tolerance)
    if (breakIndex < 0) continue
    const afterBreak = bars.slice(breakIndex)
    const failed = afterBreak.some((bar) => bar.close > level.price + tolerance)
    if (!failed || latest.close <= level.price) continue
    const maxExcursion = level.price - Math.min(...afterBreak.map((bar) => bar.low))
    const reclaimDepth = latest.close - level.price
    const greenBody = Math.max(0, latest.close - latest.open)
    const latestRange = Math.max(latest.high - latest.low, Math.abs(latest.close) * 0.00001)
    const confirmationStrength = clamp(
      (maxExcursion / Math.max(tolerance, 0.00001)) * 20
      + (reclaimDepth / Math.max(tolerance, 0.00001)) * 20
      + (greenBody / latestRange) * 40,
    )
    const confidence = clamp(confirmationStrength * 0.85 + Math.min(15, afterBreak.length * 2))
    const result: TrappedTraderResult = {
      confidence,
      confirmationStrength,
      failedLevel: level.name,
      failedLevelPrice: level.price,
      likelyStopZone: Math.min(...afterBreak.map((bar) => bar.low)) - tolerance,
      reason: `BEAR_TRAP: precio rompio ${level.name} y recupero arriba; vendedores quedan atrapados bajo ${level.price}.`,
      reclaimOrRejectPrice: latest.close,
      trapType: 'BEAR_TRAP',
      trappedSide: 'SELLERS',
    }
    if (!bestBear || result.confidence > bestBear.confidence) bestBear = result
  }

  const best = [bestBull, bestBear]
    .filter((item): item is TrappedTraderResult => Boolean(item))
    .sort((left, right) => right.confidence - left.confidence)[0]

  return best ?? {
    confidence: 0,
    confirmationStrength: 0,
    failedLevel: null,
    failedLevelPrice: null,
    likelyStopZone: null,
    reason: 'No hay ruptura fallida clara en niveles del dia previo, overnight u opening range.',
    reclaimOrRejectPrice: latest.close,
    trapType: 'NONE',
    trappedSide: 'NONE',
  }
}
