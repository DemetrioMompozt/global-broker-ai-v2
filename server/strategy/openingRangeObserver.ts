import type { ProfessionalOpeningBar } from './trappedTraderDetector.js'
import { newYorkDay, newYorkMinutes } from './tradingTimezone.js'

export type OpeningRangeObserverStatus = {
  evidence: {
    barsUsed: number
    highBar: ProfessionalOpeningBar | null
    lowBar: ProfessionalOpeningBar | null
    windowEndNewYork: '09:45'
    windowStartNewYork: '09:30'
  }
  fakeBreakAbove: boolean
  fakeBreakBelow: boolean
  firstImpulseDirection: 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN'
  firstImpulseStrength: number
  openingRangeDirection: 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN'
  openingRangeHigh: number | null
  openingRangeLow: number | null
  openingRangeMid: number | null
  openingRangeSize: number | null
  reactionAtPreviousLevels: boolean
  state: 'WAITING_FOR_MARKET_OPEN' | 'WAITING_FIRST_15_MINUTES' | 'OPENING_RANGE_COMPLETED'
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function emptyEvidence(): OpeningRangeObserverStatus['evidence'] {
  return {
    barsUsed: 0,
    highBar: null,
    lowBar: null,
    windowEndNewYork: '09:45',
    windowStartNewYork: '09:30',
  }
}

function openingRangeEvidence(openingBars: ProfessionalOpeningBar[]): OpeningRangeObserverStatus['evidence'] {
  if (!openingBars.length) return emptyEvidence()
  const highBar = openingBars.reduce((best, bar) => (bar.high > best.high ? bar : best), openingBars[0]!)
  const lowBar = openingBars.reduce((best, bar) => (bar.low < best.low ? bar : best), openingBars[0]!)
  return {
    barsUsed: openingBars.length,
    highBar,
    lowBar,
    windowEndNewYork: '09:45',
    windowStartNewYork: '09:30',
  }
}

export function observeOpeningRange(input: {
  bars: ProfessionalOpeningBar[]
  now?: Date
  previousLevels?: Array<number | null | undefined>
}): OpeningRangeObserverStatus {
  const now = input.now ?? new Date()
  const minutes = newYorkMinutes(now)
  if (minutes < 9 * 60 + 30) {
    return {
      evidence: emptyEvidence(),
      fakeBreakAbove: false,
      fakeBreakBelow: false,
      firstImpulseDirection: 'UNKNOWN',
      firstImpulseStrength: 0,
      openingRangeDirection: 'UNKNOWN',
      openingRangeHigh: null,
      openingRangeLow: null,
      openingRangeMid: null,
      openingRangeSize: null,
      reactionAtPreviousLevels: false,
      state: 'WAITING_FOR_MARKET_OPEN',
    }
  }

  const today = newYorkDay(now)
  const openingBars = input.bars.filter((bar) => {
    const time = new Date(bar.timestamp)
    const barMinutes = newYorkMinutes(time)
    return newYorkDay(time) === today && barMinutes >= 9 * 60 + 30 && barMinutes < 9 * 60 + 45
  })
  const state = minutes < 9 * 60 + 45 ? 'WAITING_FIRST_15_MINUTES' : 'OPENING_RANGE_COMPLETED'
  if (!openingBars.length) {
    return {
      evidence: emptyEvidence(),
      fakeBreakAbove: false,
      fakeBreakBelow: false,
      firstImpulseDirection: 'UNKNOWN',
      firstImpulseStrength: 0,
      openingRangeDirection: 'UNKNOWN',
      openingRangeHigh: null,
      openingRangeLow: null,
      openingRangeMid: null,
      openingRangeSize: null,
      reactionAtPreviousLevels: false,
      state,
    }
  }

  const openingRangeHigh = Math.max(...openingBars.map((bar) => bar.high))
  const openingRangeLow = Math.min(...openingBars.map((bar) => bar.low))
  const evidence = openingRangeEvidence(openingBars)
  const openingRangeMid = (openingRangeHigh + openingRangeLow) / 2
  const openingRangeSize = openingRangeHigh - openingRangeLow
  const first = openingBars[0]
  const latest = openingBars.at(-1)!
  const move = latest.close - first.open
  const openingRangeDirection = Math.abs(move) < Math.max(openingRangeSize * 0.12, 0.0001)
    ? 'FLAT'
    : move > 0
      ? 'UP'
      : 'DOWN'
  const previousLevels = (input.previousLevels ?? []).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const reactionAtPreviousLevels = previousLevels.some((level) => openingBars.some((bar) => bar.low <= level && bar.high >= level))

  return {
    evidence,
    fakeBreakAbove: latest.high > openingRangeHigh && latest.close < openingRangeHigh,
    fakeBreakBelow: latest.low < openingRangeLow && latest.close > openingRangeLow,
    firstImpulseDirection: openingRangeDirection,
    firstImpulseStrength: clamp(Math.abs(move) / Math.max(openingRangeSize, 0.0001) * 100),
    openingRangeDirection,
    openingRangeHigh,
    openingRangeLow,
    openingRangeMid,
    openingRangeSize,
    reactionAtPreviousLevels,
    state,
  }
}
