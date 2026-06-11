import type { ProfessionalOpeningBar } from './trappedTraderDetector.js'

export type TrendlineFailureSetupStatus = {
  attemptedRecoveryCount: number
  canUseForEntry: boolean
  direction: 'LONG' | 'SHORT' | 'NONE'
  reason: string
  state:
    | 'WAITING_FOR_SWING_POINTS'
    | 'TRENDLINE_ACTIVE'
    | 'BROKEN_WITHOUT_RETEST'
    | 'RECOVERY_STILL_HOLDING'
    | 'RECOVERY_ATTEMPT_FAILED'
  trendline: {
    anchorCount: number
    anchors: Array<{
      price: number
      role: 'START' | 'CONFIRMATION' | 'END'
      timestamp: string
    }>
    confirmationPrice: number
    confirmationTimestamp: string
    endPrice: number
    endTimestamp: string
    projectedCurrentPrice: number
    qualityScore: number
    role: 'RISING_SUPPORT' | 'FALLING_RESISTANCE'
    slopePerMinute: number
    startPrice: number
    startTimestamp: string
  } | null
}

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function minutesBetween(left: string, right: string) {
  const start = Date.parse(left)
  const end = Date.parse(right)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1
  return Math.max(1, Math.abs(end - start) / 60_000)
}

function projectedPrice(input: {
  endPrice: number
  endTimestamp: string
  slopePerMinute: number
  timestamp: string
}) {
  const end = Date.parse(input.endTimestamp)
  const now = Date.parse(input.timestamp)
  if (!Number.isFinite(end) || !Number.isFinite(now)) return input.endPrice
  return input.endPrice + ((now - end) / 60_000) * input.slopePerMinute
}

function projectedFromStart(input: {
  slopePerMinute: number
  startPrice: number
  startTimestamp: string
  timestamp: string
}) {
  const start = Date.parse(input.startTimestamp)
  const target = Date.parse(input.timestamp)
  if (!Number.isFinite(start) || !Number.isFinite(target)) return input.startPrice
  return input.startPrice + ((target - start) / 60_000) * input.slopePerMinute
}

function averageRange(bars: ProfessionalOpeningBar[]) {
  const ranges = bars
    .map((bar) => bar.high - bar.low)
    .filter((value) => Number.isFinite(value) && value > 0)
  if (!ranges.length) return 1
  return ranges.reduce((sum, value) => sum + value, 0) / ranges.length
}

function bodyLow(bar: ProfessionalOpeningBar) {
  return Math.min(bar.open, bar.close)
}

function bodyHigh(bar: ProfessionalOpeningBar) {
  return Math.max(bar.open, bar.close)
}

function swingLows(bars: ProfessionalOpeningBar[]) {
  return bars
    .map((bar, index) => ({ bar, index }))
    .filter(({ bar, index }) => {
      const previous = bars[index - 1]
      const next = bars[index + 1]
      return previous && next && bar.low <= previous.low && bar.low <= next.low
    })
}

function swingHighs(bars: ProfessionalOpeningBar[]) {
  return bars
    .map((bar, index) => ({ bar, index }))
    .filter(({ bar, index }) => {
      const previous = bars[index - 1]
      const next = bars[index + 1]
      return previous && next && bar.high >= previous.high && bar.high >= next.high
    })
}

type Pivot = ReturnType<typeof swingLows>[number]

function pivotPrice(direction: 'LONG' | 'SHORT', pivot: Pivot) {
  return direction === 'SHORT' ? pivot.bar.low : pivot.bar.high
}

function countTrendlineBodyViolations(input: {
  bars: ProfessionalOpeningBar[]
  direction: 'LONG' | 'SHORT'
  end: Pivot
  slopePerMinute: number
  start: Pivot
  tolerance: number
}) {
  let violations = 0
  for (let index = input.start.index + 1; index < input.end.index; index += 1) {
    const bar = input.bars[index]
    const line = projectedFromStart({
      slopePerMinute: input.slopePerMinute,
      startPrice: pivotPrice(input.direction, input.start),
      startTimestamp: input.start.bar.timestamp,
      timestamp: bar.timestamp,
    })
    if (input.direction === 'SHORT' && bodyLow(bar) < line - input.tolerance) violations += 1
    if (input.direction === 'LONG' && bodyHigh(bar) > line + input.tolerance) violations += 1
  }
  return violations
}

function countTrendlineTouches(input: {
  bars: ProfessionalOpeningBar[]
  direction: 'LONG' | 'SHORT'
  end: Pivot
  slopePerMinute: number
  start: Pivot
  tolerance: number
}) {
  let touches = 2
  for (let index = input.start.index + 1; index < input.end.index; index += 1) {
    const bar = input.bars[index]
    const line = projectedFromStart({
      slopePerMinute: input.slopePerMinute,
      startPrice: pivotPrice(input.direction, input.start),
      startTimestamp: input.start.bar.timestamp,
      timestamp: bar.timestamp,
    })
    const distance = input.direction === 'SHORT'
      ? Math.abs(bar.low - line)
      : Math.abs(bar.high - line)
    if (distance <= input.tolerance * 2.5) touches += 1
  }
  return touches
}

function middleTouchPivots(input: {
  direction: 'LONG' | 'SHORT'
  end: Pivot
  pivots: Pivot[]
  slopePerMinute: number
  start: Pivot
  tolerance: number
}) {
  return input.pivots
    .filter((pivot) => pivot.index > input.start.index && pivot.index < input.end.index)
    .filter((pivot) => {
      const line = projectedFromStart({
        slopePerMinute: input.slopePerMinute,
        startPrice: pivotPrice(input.direction, input.start),
        startTimestamp: input.start.bar.timestamp,
        timestamp: pivot.bar.timestamp,
      })
      return Math.abs(pivotPrice(input.direction, pivot) - line) <= input.tolerance * 2
    })
}

function selectCleanTrendlineStructure(input: {
  averageRange: number
  bars: ProfessionalOpeningBar[]
  direction: 'LONG' | 'SHORT'
  pivots: Pivot[]
  tolerance: number
}): { confirmation: Pivot; end: Pivot; qualityScore: number; start: Pivot; touchCount: number } | null {
  let best: { confirmation: Pivot; end: Pivot; qualityScore: number; start: Pivot; touchCount: number } | null = null
  for (let right = input.pivots.length - 1; right > 0; right -= 1) {
    for (let left = right - 1; left >= 0; left -= 1) {
      const start = input.pivots[left]
      const end = input.pivots[right]
      const separation = end.index - start.index
      if (separation < 3) continue
      if (input.bars.length - end.index < 4) continue
      const priceDelta = pivotPrice(input.direction, end) - pivotPrice(input.direction, start)
      if (input.direction === 'SHORT' && priceDelta <= Math.max(input.tolerance * 0.75, input.averageRange * 0.025)) continue
      if (input.direction === 'LONG' && priceDelta >= -Math.max(input.tolerance * 0.75, input.averageRange * 0.025)) continue
      const slopePerMinute = priceDelta / minutesBetween(start.bar.timestamp, end.bar.timestamp)
      const middleTouches = middleTouchPivots({
        direction: input.direction,
        end,
        pivots: input.pivots,
        slopePerMinute,
        start,
        tolerance: input.tolerance,
      })
      if (!middleTouches.length) continue
      const violations = countTrendlineBodyViolations({
        bars: input.bars,
        direction: input.direction,
        end,
        slopePerMinute,
        start,
        tolerance: input.tolerance,
      })
      if (violations > 0) continue
      const touches = countTrendlineTouches({
        bars: input.bars,
        direction: input.direction,
        end,
        slopePerMinute,
        start,
        tolerance: input.tolerance,
      })
      const normalizedSlope = Math.abs(priceDelta) / Math.max(input.averageRange * separation, input.tolerance)
      const steepPenalty = normalizedSlope > 1.15 ? (normalizedSlope - 1.15) * 12 : 0
      const confirmation = middleTouches.at(-1) ?? middleTouches[0]
      const score = end.index * 1.2 + Math.min(separation, 10) * 2.4 + touches * 5 + middleTouches.length * 8 - steepPenalty
      if (!best || score > best.qualityScore) {
        best = { confirmation, end, qualityScore: Math.round(score * 10) / 10, start, touchCount: touches }
      }
    }
  }
  return best
}

function empty(reason: string): TrendlineFailureSetupStatus {
  return {
    attemptedRecoveryCount: 0,
    canUseForEntry: false,
    direction: 'NONE',
    reason,
    state: 'WAITING_FOR_SWING_POINTS',
    trendline: null,
  }
}

export function analyzeTrendlineFailureSetup(input: {
  bars: ProfessionalOpeningBar[]
  direction: 'LONG' | 'SHORT'
  toleranceBps?: number
}): TrendlineFailureSetupStatus {
  const bars = input.bars.filter((bar) => [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite))
  const latest = bars.at(-1)
  if (!latest || bars.length < 8) {
    return empty('No hay suficientes velas M1 posteriores al opening range para trazar linea de tendencia y fallo.')
  }

  const tolerance = Math.max(latest.close * ((input.toleranceBps ?? 2.5) / 10_000), 0.01)
  const avgRange = averageRange(bars)

  if (input.direction === 'SHORT') {
    const lows = swingLows(bars)
    const structure = selectCleanTrendlineStructure({ averageRange: avgRange, bars, direction: 'SHORT', pivots: lows, tolerance })
    if (!structure) return empty('Todavia no hay tres toques limpios en minimos ascendentes; no se dibuja trendline operable.')

    const { confirmation, end, qualityScore, start, touchCount } = structure
    const slopePerMinute = (end.bar.low - start.bar.low) / minutesBetween(start.bar.timestamp, end.bar.timestamp)
    const projectedCurrentPrice = projectedPrice({
      endPrice: end.bar.low,
      endTimestamp: end.bar.timestamp,
      slopePerMinute,
      timestamp: latest.timestamp,
    })
    const trendline = {
      anchorCount: 3,
      anchors: [
        { price: start.bar.low, role: 'START' as const, timestamp: start.bar.timestamp },
        { price: confirmation.bar.low, role: 'CONFIRMATION' as const, timestamp: confirmation.bar.timestamp },
        { price: end.bar.low, role: 'END' as const, timestamp: end.bar.timestamp },
      ],
      confirmationPrice: confirmation.bar.low,
      confirmationTimestamp: confirmation.bar.timestamp,
      endPrice: end.bar.low,
      endTimestamp: end.bar.timestamp,
      projectedCurrentPrice,
      qualityScore,
      role: 'RISING_SUPPORT' as const,
      slopePerMinute,
      startPrice: start.bar.low,
      startTimestamp: start.bar.timestamp,
    }
    const afterLine = bars.slice(end.index + 1)
    const breakIndex = afterLine.findIndex((bar) => {
      const line = projectedPrice({ endPrice: end.bar.low, endTimestamp: end.bar.timestamp, slopePerMinute, timestamp: bar.timestamp })
      return bar.close < line - tolerance
    })
    if (breakIndex < 0) {
      return {
        attemptedRecoveryCount: 0,
        canUseForEntry: false,
        direction: 'SHORT',
        reason: `Linea alcista de 3 puntos activa (${touchCount} toques); todavia no rompio debajo con cierre M1.`,
        state: 'TRENDLINE_ACTIVE',
        trendline,
      }
    }
    const afterBreak = afterLine.slice(breakIndex + 1)
    const failedAttempts = afterBreak.filter((bar) => {
      const line = projectedPrice({ endPrice: end.bar.low, endTimestamp: end.bar.timestamp, slopePerMinute, timestamp: bar.timestamp })
      return bar.high >= line - tolerance && bar.close < line - tolerance
    }).length
    const latestLine = projectedCurrentPrice
    if (failedAttempts > 0 && latest.close < latestLine - tolerance) {
      return {
        attemptedRecoveryCount: failedAttempts,
        canUseForEntry: true,
        direction: 'SHORT',
        reason: `Ruptura debajo de linea alcista de 3 puntos y ${failedAttempts} intento(s) fallido(s) de recuperarla; compradores quedan mal jugados.`,
        state: 'RECOVERY_ATTEMPT_FAILED',
        trendline,
      }
    }
    return {
      attemptedRecoveryCount: failedAttempts,
      canUseForEntry: false,
      direction: 'SHORT',
      reason: failedAttempts > 0
        ? 'Hubo intento fallido, pero el ultimo precio no sigue debajo de la linea con margen suficiente.'
        : 'Rompio la linea de 3 puntos, pero aun falta retest/fallo de recuperacion antes de entrar.',
      state: failedAttempts > 0 ? 'RECOVERY_STILL_HOLDING' : 'BROKEN_WITHOUT_RETEST',
      trendline,
    }
  }

  const highs = swingHighs(bars)
  const structure = selectCleanTrendlineStructure({ averageRange: avgRange, bars, direction: 'LONG', pivots: highs, tolerance })
  if (!structure) return empty('Todavia no hay tres toques limpios en maximos descendentes; no se dibuja trendline operable.')

  const { confirmation, end, qualityScore, start, touchCount } = structure
  const slopePerMinute = (end.bar.high - start.bar.high) / minutesBetween(start.bar.timestamp, end.bar.timestamp)
  const projectedCurrentPrice = projectedPrice({
    endPrice: end.bar.high,
    endTimestamp: end.bar.timestamp,
    slopePerMinute,
    timestamp: latest.timestamp,
  })
  const trendline = {
    anchorCount: 3,
    anchors: [
      { price: start.bar.high, role: 'START' as const, timestamp: start.bar.timestamp },
      { price: confirmation.bar.high, role: 'CONFIRMATION' as const, timestamp: confirmation.bar.timestamp },
      { price: end.bar.high, role: 'END' as const, timestamp: end.bar.timestamp },
    ],
    confirmationPrice: confirmation.bar.high,
    confirmationTimestamp: confirmation.bar.timestamp,
    endPrice: end.bar.high,
    endTimestamp: end.bar.timestamp,
    projectedCurrentPrice,
    qualityScore,
    role: 'FALLING_RESISTANCE' as const,
    slopePerMinute,
    startPrice: start.bar.high,
    startTimestamp: start.bar.timestamp,
  }
  const afterLine = bars.slice(end.index + 1)
  const breakIndex = afterLine.findIndex((bar) => {
    const line = projectedPrice({ endPrice: end.bar.high, endTimestamp: end.bar.timestamp, slopePerMinute, timestamp: bar.timestamp })
    return bar.close > line + tolerance
  })
  if (breakIndex < 0) {
    return {
      attemptedRecoveryCount: 0,
      canUseForEntry: false,
      direction: 'LONG',
      reason: `Linea bajista de 3 puntos activa (${touchCount} toques); todavia no rompio arriba con cierre M1.`,
      state: 'TRENDLINE_ACTIVE',
      trendline,
    }
  }
  const afterBreak = afterLine.slice(breakIndex + 1)
  const failedAttempts = afterBreak.filter((bar) => {
    const line = projectedPrice({ endPrice: end.bar.high, endTimestamp: end.bar.timestamp, slopePerMinute, timestamp: bar.timestamp })
    return bar.low <= line + tolerance && bar.close > line + tolerance
  }).length
  if (failedAttempts > 0 && latest.close > projectedCurrentPrice + tolerance) {
    return {
      attemptedRecoveryCount: failedAttempts,
      canUseForEntry: true,
      direction: 'LONG',
      reason: `Ruptura arriba de linea bajista de 3 puntos y ${failedAttempts} intento(s) fallido(s) de volver debajo; vendedores quedan mal jugados.`,
      state: 'RECOVERY_ATTEMPT_FAILED',
      trendline,
    }
  }
  return {
    attemptedRecoveryCount: failedAttempts,
    canUseForEntry: false,
    direction: 'LONG',
    reason: failedAttempts > 0
      ? 'Hubo intento fallido, pero el ultimo precio no sigue arriba de la linea con margen suficiente.'
      : 'Rompio la linea de 3 puntos, pero aun falta retest/fallo antes de entrar.',
    state: failedAttempts > 0 ? 'RECOVERY_STILL_HOLDING' : 'BROKEN_WITHOUT_RETEST',
    trendline,
  }
}
