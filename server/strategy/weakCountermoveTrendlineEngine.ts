import { analyzeMovementNature, type MovementNatureResult } from './movementNatureAnalyzer.js'
import { analyzeTrendlineCandlestickExpert, type TrendlineCandlestickExpertStatus } from './trendlineCandlestickExpert.js'
import { analyzeTrendlineFailureSetup, type TrendlineFailureSetupStatus } from './trendlineFailureSetup.js'
import type { ProfessionalOpeningBar, ProfessionalOpeningLevels } from './trappedTraderDetector.js'
import type { WrongSidedTraderResult } from './wrongSidedTraderDetector.js'

export type WeakCountermoveTrendlineState =
  | 'WAITING_OPENING_RANGE_15M'
  | 'OPENING_RANGE_MARKED'
  | 'TESTING_OPENING_RANGE_HIGH'
  | 'TESTING_OPENING_RANGE_LOW'
  | 'BREAKOUT_ACCEPTED'
  | 'BREAKOUT_FAILED'
  | 'BUYERS_TRAPPED'
  | 'SELLERS_TRAPPED'
  | 'WEAK_COUNTERMOVE_DETECTED'
  | 'COUNTERMOVE_TRENDLINE_DRAWN'
  | 'TRENDLINE_BROKEN'
  | 'RETEST_FAILED'
  | 'BLOCKED_NO_WEAK_COUNTERMOVE'
  | 'BLOCKED_NO_TRENDLINE_BREAK'
  | 'BLOCKED_NO_RETEST_FAILURE'

export type WeakCountermoveTrendlineStatus = {
  canUseForEntry: boolean
  counterMoveBars: number
  intendedDirection: 'LONG' | 'SHORT' | 'NONE'
  latestMissedOpportunity: WeakCountermoveMissedOpportunity | null
  missedOpportunities: WeakCountermoveMissedOpportunity[]
  movementNature: MovementNatureResult | null
  openingRangeLevel: 'HIGH' | 'LOW' | null
  reason: string
  state: WeakCountermoveTrendlineState
  trappedSide: 'BUYERS' | 'SELLERS' | 'NONE'
  trendlineFailure: TrendlineFailureSetupStatus | null
  trendlineCandlestickExpert: TrendlineCandlestickExpertStatus | null
  weakCountermoveScore: number
  wrongSidedTrader: WrongSidedTraderResult | null
}

export type WeakCountermoveMissedOpportunity = {
  candlestickConfirmationScore: number
  direction: 'LONG' | 'SHORT'
  detectedAt: string
  openingRangeLevel: 'HIGH' | 'LOW'
  reason: string
  retestFailureScore: number
  trappedSide: 'BUYERS' | 'SELLERS'
  trendline: TrendlineFailureSetupStatus['trendline']
  trendlineQualityScore: number
  weakCountermoveScore: number
}

type TrapCandidate = {
  breakIndex: number
  failedIndex: number
  levelPrice: number
  side: 'BUYERS' | 'SELLERS'
  type: 'HIGH' | 'LOW'
}

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function averageRange(bars: ProfessionalOpeningBar[]) {
  const ranges = bars.map((bar) => bar.high - bar.low).filter((value) => Number.isFinite(value) && value > 0)
  if (!ranges.length) return 0
  return ranges.reduce((sum, value) => sum + value, 0) / ranges.length
}

function overlapPercent(left: ProfessionalOpeningBar, right: ProfessionalOpeningBar) {
  const overlap = Math.min(left.high, right.high) - Math.max(left.low, right.low)
  const base = Math.max(Math.min(left.high - left.low, right.high - right.low), 0.00001)
  return clamp((Math.max(0, overlap) / base) * 100)
}

function alternationCount(bars: ProfessionalOpeningBar[]) {
  let alternations = 0
  let previousSign = 0
  for (let index = 1; index < bars.length; index += 1) {
    const previous = bars[index - 1]
    const current = bars[index]
    const delta = current.close - previous.close
    const sign = delta > 0 ? 1 : delta < 0 ? -1 : 0
    if (sign !== 0 && previousSign !== 0 && sign !== previousSign) alternations += 1
    if (sign !== 0) previousSign = sign
  }
  return alternations
}

function empty(state: WeakCountermoveTrendlineState, reason: string): WeakCountermoveTrendlineStatus {
  return {
    canUseForEntry: false,
    counterMoveBars: 0,
    intendedDirection: 'NONE',
    latestMissedOpportunity: null,
    missedOpportunities: [],
    movementNature: null,
    openingRangeLevel: null,
    reason,
    state,
    trappedSide: 'NONE',
    trendlineFailure: null,
    trendlineCandlestickExpert: null,
    weakCountermoveScore: 0,
    wrongSidedTrader: null,
  }
}

function detectOpeningRangeTrap(input: {
  bars: ProfessionalOpeningBar[]
  levels: ProfessionalOpeningLevels
  tolerance: number
}): { accepted: boolean; candidate: TrapCandidate | null; testing: 'HIGH' | 'LOW' | null } {
  const candidates: TrapCandidate[] = []
  const high = input.levels.openingRangeHigh
  const low = input.levels.openingRangeLow
  let accepted = false

  if (finite(high)) {
    const breakIndex = input.bars.findIndex((bar) => bar.high > high + input.tolerance * 0.25)
    if (breakIndex >= 0) {
      const afterBreak = input.bars.slice(breakIndex)
      const failedIndex = afterBreak.findIndex((bar) => bar.close < high - input.tolerance * 0.25)
      const sustained = afterBreak.slice(-3).length === 3 && afterBreak.slice(-3).every((bar) => bar.close > high + input.tolerance)
      if (sustained) {
        accepted = true
      }
      if (failedIndex >= 0) {
        candidates.push({
          breakIndex,
          failedIndex: breakIndex + failedIndex,
          levelPrice: high,
          side: 'BUYERS',
          type: 'HIGH',
        })
      } else if (!accepted) {
        return { accepted: false, candidate: null, testing: 'HIGH' }
      }
    }
  }

  if (finite(low)) {
    const breakIndex = input.bars.findIndex((bar) => bar.low < low - input.tolerance * 0.25)
    if (breakIndex >= 0) {
      const afterBreak = input.bars.slice(breakIndex)
      const failedIndex = afterBreak.findIndex((bar) => bar.close > low + input.tolerance * 0.25)
      const sustained = afterBreak.slice(-3).length === 3 && afterBreak.slice(-3).every((bar) => bar.close < low - input.tolerance)
      if (sustained) {
        accepted = true
      }
      if (failedIndex >= 0) {
        candidates.push({
          breakIndex,
          failedIndex: breakIndex + failedIndex,
          levelPrice: low,
          side: 'SELLERS',
          type: 'LOW',
        })
      } else if (!accepted) {
        return { accepted: false, candidate: null, testing: 'LOW' }
      }
    }
  }

  const candidate = candidates.sort((left, right) => right.failedIndex - left.failedIndex)[0] ?? null
  return { accepted, candidate, testing: null }
}

function wrongSidedFromTrap(input: {
  bars: ProfessionalOpeningBar[]
  candidate: TrapCandidate
  tolerance: number
}): WrongSidedTraderResult {
  const afterBreak = input.bars.slice(input.candidate.breakIndex)
  const latest = input.bars.at(-1)
  const confidence = clamp(55 + afterBreak.length * 2)
  if (input.candidate.side === 'BUYERS') {
    return {
      confidence,
      confirmationStrength: confidence,
      failedLevel: 'openingRangeHigh',
      failedLevelPrice: input.candidate.levelPrice,
      likelyStopZone: Math.max(...afterBreak.map((bar) => bar.high)) + input.tolerance,
      reason: `BUYERS_TRAPPED: intento sobre opening range high ${input.candidate.levelPrice} fallo y regreso debajo.`,
      reclaimOrRejectPrice: latest?.close ?? null,
      trapType: 'BULL_TRAP',
      trappedSide: 'BUYERS',
      wrongSidedState: 'BUYERS_TRAPPED',
    }
  }
  return {
    confidence,
    confirmationStrength: confidence,
    failedLevel: 'openingRangeLow',
    failedLevelPrice: input.candidate.levelPrice,
    likelyStopZone: Math.min(...afterBreak.map((bar) => bar.low)) - input.tolerance,
    reason: `SELLERS_TRAPPED: intento bajo opening range low ${input.candidate.levelPrice} fallo y recupero arriba.`,
    reclaimOrRejectPrice: latest?.close ?? null,
    trapType: 'BEAR_TRAP',
    trappedSide: 'SELLERS',
    wrongSidedState: 'SELLERS_TRAPPED',
  }
}

function assessWeakCountermove(input: {
  bars: ProfessionalOpeningBar[]
  failedIndex: number
  side: 'LONG' | 'SHORT'
}) {
  const postFailure = input.bars.slice(input.failedIndex)
  if (postFailure.length < 6) return { bars: postFailure, score: 0 }
  if (input.side === 'SHORT') {
    const pivotOffset = postFailure.reduce((best, bar, index) => bar.low < postFailure[best].low ? index : best, 0)
    const counterMoveBars = postFailure.slice(pivotOffset)
    const impulseDistance = Math.max(0.00001, postFailure[0].close - postFailure[pivotOffset].low)
    const counterAdvance = Math.max(0, (counterMoveBars.at(-1)?.close ?? postFailure[pivotOffset].low) - postFailure[pivotOffset].low)
    const overlap = counterMoveBars.length > 1
      ? counterMoveBars.slice(1).reduce((sum, bar, index) => sum + overlapPercent(counterMoveBars[index], bar), 0) / (counterMoveBars.length - 1)
      : 0
    const alternations = alternationCount(counterMoveBars)
    const advanceScore = clamp((1 - Math.min(1, counterAdvance / impulseDistance)) * 45)
    return {
      bars: counterMoveBars,
      score: clamp(advanceScore + overlap * 0.35 + Math.min(20, alternations * 5)),
    }
  }

  const pivotOffset = postFailure.reduce((best, bar, index) => bar.high > postFailure[best].high ? index : best, 0)
  const counterMoveBars = postFailure.slice(pivotOffset)
  const impulseDistance = Math.max(0.00001, postFailure[pivotOffset].high - postFailure[0].close)
  const counterAdvance = Math.max(0, postFailure[pivotOffset].high - (counterMoveBars.at(-1)?.close ?? postFailure[pivotOffset].high))
  const overlap = counterMoveBars.length > 1
    ? counterMoveBars.slice(1).reduce((sum, bar, index) => sum + overlapPercent(counterMoveBars[index], bar), 0) / (counterMoveBars.length - 1)
    : 0
  const alternations = alternationCount(counterMoveBars)
  const advanceScore = clamp((1 - Math.min(1, counterAdvance / impulseDistance)) * 45)
  return {
    bars: counterMoveBars,
    score: clamp(advanceScore + overlap * 0.35 + Math.min(20, alternations * 5)),
  }
}

function trendlineState(trendline: TrendlineFailureSetupStatus): WeakCountermoveTrendlineState {
  if (trendline.state === 'RECOVERY_ATTEMPT_FAILED') return 'RETEST_FAILED'
  if (trendline.state === 'BROKEN_WITHOUT_RETEST' || trendline.state === 'RECOVERY_STILL_HOLDING') return 'TRENDLINE_BROKEN'
  if (trendline.state === 'TRENDLINE_ACTIVE') return 'COUNTERMOVE_TRENDLINE_DRAWN'
  return 'BLOCKED_NO_TRENDLINE_BREAK'
}

function missedOpportunityKey(item: WeakCountermoveMissedOpportunity) {
  const anchors = item.trendline?.anchors.map((anchor) => `${anchor.timestamp}:${anchor.price}`).join('|') ?? 'no-line'
  return `${item.detectedAt}|${item.direction}|${item.trappedSide}|${anchors}`
}

function minutesBetweenTimestamps(left: string | null | undefined, right: string | null | undefined) {
  const leftTime = Date.parse(String(left ?? ''))
  const rightTime = Date.parse(String(right ?? ''))
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return Infinity
  return Math.abs(rightTime - leftTime) / 60_000
}

function detectMissedOpportunities(input: {
  bars: ProfessionalOpeningBar[]
  candidate: TrapCandidate
  side: 'LONG' | 'SHORT'
}) {
  const found = new Map<string, WeakCountermoveMissedOpportunity>()
  for (let end = input.candidate.failedIndex + 8; end <= input.bars.length; end += 1) {
    const prefix = input.bars.slice(0, end)
    const weak = assessWeakCountermove({ bars: prefix, failedIndex: input.candidate.failedIndex, side: input.side })
    if (weak.bars.length < 5 || weak.score < 40) continue
    const trendlineFailure = analyzeTrendlineFailureSetup({ bars: prefix.slice(input.candidate.failedIndex), direction: input.side })
    if (!trendlineFailure.canUseForEntry) continue
    const trendlineCandlestickExpert = analyzeTrendlineCandlestickExpert({
      bars: prefix.slice(input.candidate.failedIndex),
      direction: input.side,
      trendlineFailure,
    })
    if (trendlineCandlestickExpert.status !== 'CONFIRMED') continue
    const latest = prefix.at(-1)
    if (!latest) continue
    const item: WeakCountermoveMissedOpportunity = {
      candlestickConfirmationScore: trendlineCandlestickExpert.candlestickConfirmationScore,
      detectedAt: latest.timestamp,
      direction: input.side,
      openingRangeLevel: input.candidate.type,
      reason: `${input.candidate.side === 'BUYERS' ? 'Compradores' : 'Vendedores'} atrapados: ${trendlineFailure.reason} ${trendlineCandlestickExpert.candleRead}`,
      retestFailureScore: trendlineCandlestickExpert.retestFailureScore,
      trappedSide: input.candidate.side,
      trendline: trendlineFailure.trendline,
      trendlineQualityScore: trendlineCandlestickExpert.trendlineQualityScore,
      weakCountermoveScore: Math.round(weak.score * 10) / 10,
    }
    found.set(missedOpportunityKey(item), item)
  }
  return [...found.values()]
    .sort((left, right) => Date.parse(left.detectedAt) - Date.parse(right.detectedAt))
    .slice(-5)
}

export function analyzeWeakCountermoveTrendline(input: {
  bars: ProfessionalOpeningBar[]
  levels: ProfessionalOpeningLevels
  toleranceBps?: number
}): WeakCountermoveTrendlineStatus {
  const bars = input.bars
    .filter((bar) => [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
  const latest = bars.at(-1)
  if (!latest || bars.length < 2 || !finite(input.levels.openingRangeHigh) || !finite(input.levels.openingRangeLow)) {
    return empty('WAITING_OPENING_RANGE_15M', 'Primero deben terminar los 15 minutos de 09:30-09:45 y quedar marcado high/low del opening range.')
  }

  const openingRangeSize = Math.abs(input.levels.openingRangeHigh - input.levels.openingRangeLow)
  const tolerance = Math.max(latest.close * ((input.toleranceBps ?? 1.5) / 10_000), openingRangeSize * 0.025, averageRange(bars) * 0.25, 0.01)
  const trap = detectOpeningRangeTrap({ bars, levels: input.levels, tolerance })
  if (trap.accepted && !trap.candidate) {
    return empty('BREAKOUT_ACCEPTED', 'La ruptura del opening range esta siendo aceptada; no hay traders debiles atrapados para el metodo.')
  }
  if (trap.testing === 'HIGH') {
    return empty('TESTING_OPENING_RANGE_HIGH', 'El precio esta probando el high del opening range; esperar aceptacion o fallo antes de trazar trendline.')
  }
  if (trap.testing === 'LOW') {
    return empty('TESTING_OPENING_RANGE_LOW', 'El precio esta probando el low del opening range; esperar aceptacion o fallo antes de trazar trendline.')
  }
  if (!trap.candidate) {
    return empty('OPENING_RANGE_MARKED', 'Opening range marcado; aun no hay intento/fallo claro en high o low.')
  }

  const side = trap.candidate.side === 'BUYERS' ? 'SHORT' : 'LONG'
  const wrongSidedTrader = wrongSidedFromTrap({ bars, candidate: trap.candidate, tolerance })
  const weak = assessWeakCountermove({ bars, failedIndex: trap.candidate.failedIndex, side })
  const missedOpportunities = detectMissedOpportunities({ bars, candidate: trap.candidate, side })
  const latestMissedOpportunity = missedOpportunities.at(-1) ?? null
  if (trap.accepted && (weak.bars.length < 5 || weak.score < 40) && !latestMissedOpportunity) {
    return empty('BREAKOUT_ACCEPTED', 'La ruptura del opening range termino aceptada y no hubo contramovimiento debil operable antes de la aceptacion.')
  }
  const movementNature = analyzeMovementNature({
    bars: bars.slice(trap.candidate.failedIndex),
    intendedDirection: side,
  })
  if (weak.bars.length < 5 || weak.score < 40) {
    return {
      canUseForEntry: false,
      counterMoveBars: weak.bars.length,
      intendedDirection: side,
      latestMissedOpportunity,
      missedOpportunities,
      movementNature,
      openingRangeLevel: trap.candidate.type,
      reason: latestMissedOpportunity
        ? `${wrongSidedTrader.reason} Ya hubo oportunidad intradia detectada a las ${latestMissedOpportunity.detectedAt}; no abrir tarde. Falta un nuevo contramovimiento debil actual.`
        : `${wrongSidedTrader.reason} Falta contramovimiento debil con solapamiento antes de trazar trendline.`,
      state: 'BLOCKED_NO_WEAK_COUNTERMOVE',
      trappedSide: trap.candidate.side,
      trendlineFailure: null,
      trendlineCandlestickExpert: null,
      weakCountermoveScore: Math.round(weak.score * 10) / 10,
      wrongSidedTrader,
    }
  }

  const trendlineFailure = analyzeTrendlineFailureSetup({ bars: bars.slice(trap.candidate.failedIndex), direction: side })
  const trendlineCandlestickExpert = analyzeTrendlineCandlestickExpert({
    bars: bars.slice(trap.candidate.failedIndex),
    direction: side,
    trendlineFailure,
  })
  const state = trendlineState(trendlineFailure)
  const blockedState = state === 'COUNTERMOVE_TRENDLINE_DRAWN'
    ? 'BLOCKED_NO_TRENDLINE_BREAK'
    : state === 'TRENDLINE_BROKEN'
      ? 'BLOCKED_NO_RETEST_FAILURE'
      : state
  const expertBlocksEntry = trendlineFailure.canUseForEntry && trendlineCandlestickExpert.status !== 'CONFIRMED'
  const retestTimestamp = trendlineCandlestickExpert.evidence.retestCandle?.timestamp ?? null
  const minutesSinceRetest = minutesBetweenTimestamps(retestTimestamp, latest.timestamp)
  const freshRetestWindow = minutesSinceRetest <= 3
  const confirmedButStale = trendlineFailure.canUseForEntry && trendlineCandlestickExpert.status === 'CONFIRMED' && !freshRetestWindow
  const canUseForEntry = trendlineFailure.canUseForEntry && trendlineCandlestickExpert.status === 'CONFIRMED' && freshRetestWindow
  const expertBlockedState = trendlineCandlestickExpert.status === 'WAITING_BREAK'
    ? 'BLOCKED_NO_TRENDLINE_BREAK'
    : trendlineCandlestickExpert.status === 'WAITING_RETEST'
      ? 'BLOCKED_NO_RETEST_FAILURE'
      : blockedState
  const baseReason = `${wrongSidedTrader.reason} Contramovimiento debil confirmado; ${trendlineFailure.reason}`
  const expertReason = `${trendlineCandlestickExpert.trendlineRead} ${trendlineCandlestickExpert.candleRead}`
  const staleReason = latestMissedOpportunity
    ? ` Hubo oportunidad intradia a las ${latestMissedOpportunity.detectedAt}, pero ya no esta fresca; no abrir tarde.`
    : ''
  return {
    canUseForEntry,
    counterMoveBars: weak.bars.length,
    intendedDirection: side,
    latestMissedOpportunity: canUseForEntry ? null : latestMissedOpportunity,
    missedOpportunities,
    movementNature,
    openingRangeLevel: trap.candidate.type,
    reason: expertBlocksEntry
      ? `${baseReason} Pero el experto de velas bloquea: ${expertReason}`
      : confirmedButStale
        ? `${baseReason} ${expertReason}${staleReason}`
        : `${baseReason} ${expertReason}`,
    state: canUseForEntry ? state : confirmedButStale ? 'BLOCKED_NO_RETEST_FAILURE' : expertBlockedState,
    trappedSide: trap.candidate.side,
    trendlineFailure,
    trendlineCandlestickExpert,
    weakCountermoveScore: Math.round(weak.score * 10) / 10,
    wrongSidedTrader,
  }
}
