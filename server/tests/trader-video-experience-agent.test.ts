import { strict as assert } from 'node:assert'
import { buildTraderVideoExperienceAgent } from '../strategy/traderVideoExperienceAgent.js'
import type { TraderVideoSetupObservation } from '../strategy/traderVideoSetupJournal.js'
import type { ProfessionalOpeningBar } from '../strategy/trappedTraderDetector.js'

function bar(timestamp: string, open: number, high: number, low: number, close: number): ProfessionalOpeningBar {
  return { close, high, low, open, timestamp, volume: 1 }
}

function generateDay(day: string, base: number): ProfessionalOpeningBar[] {
  const bars: ProfessionalOpeningBar[] = []
  const start = Date.parse(`${day}T13:30:00.000Z`)
  for (let index = 0; index < 390; index += 1) {
    const wave = Math.sin(index / 17) * 6
    const drift = index < 120 ? index * 0.06 : 7.2 - (index - 120) * 0.035
    const open = base + wave + drift
    const close = open + Math.sin(index / 5) * 1.4
    bars.push(bar(
      new Date(start + index * 60_000).toISOString(),
      open,
      Math.max(open, close) + 1.2,
      Math.min(open, close) - 1.2,
      close,
    ))
  }
  return bars
}

const observation: TraderVideoSetupObservation = {
  analyticalDecision: 'NO_TRADE',
  bias: 'SHORT',
  blockedReasons: ['BLOCKED_NO_RETEST_FAILURE', 'BLOCKED_RR_BELOW_2'],
  componentScores: {
    candlestickConfirmationScore: 40,
    contextScore: 80,
    dataConfidenceScore: 100,
    institutionalPressureScore: 50,
    markInteractionScore: 90,
    redGreenScore: 0,
    retestFailureScore: 0,
    trappedTraderScore: 100,
    trendlineQualityScore: 80,
    weakCountermoveScore: 70,
  },
  confidence: 65,
  createdAt: '2026-06-11T15:00:00.000Z',
  id: 'test-observation',
  institutionalPressure: 'BEARISH',
  markInteractionScore: 90,
  narrative: 'Compradores atrapados, pero falta retest.',
  nextRequiredCondition: 'Esperar retest fallido.',
  openingRangeHigh: 7400,
  openingRangeLow: 7375,
  outcome: { closeReason: null, pnlUsd: null, status: 'OBSERVED_ONLY' },
  reason: 'Falta retest.',
  redGreenBox: {
    costToTargetRatio: null,
    expectedNetProfit: null,
    greenBoxReward: null,
    redBoxRisk: null,
    state: null,
    structuralTarget: null,
    targetNetUsd: null,
    technicalStop: null,
  },
  retestFailure: { canUseForEntry: false, state: 'BROKEN_WITHOUT_RETEST' },
  riskRewardRatio: null,
  sessionDate: '2026-06-11',
  state: 'BLOCKED_NO_RETEST_FAILURE',
  symbol: 'SP500',
  testedLevelName: 'ORH 09:30-09:45',
  testedLevelPrice: 7400,
  trappedSide: 'BUYERS',
  trendlineQuality: {
    anchorCount: 3,
    qualityScore: 80,
    role: 'RISING_SUPPORT',
    slopePerMinute: 0.2,
  },
  trendlineState: 'BROKEN_WITHOUT_RETEST',
  weakCountermove: {
    counterMoveBars: 12,
    score: 70,
    state: 'BLOCKED_NO_RETEST_FAILURE',
  },
}

const empty = buildTraderVideoExperienceAgent({
  bars: [],
  observations: [observation],
})

assert.equal(empty.mode, 'TRADER_VIDEO_MARKET_EXPERIENCE_AGENT')
assert.equal(empty.advisoryOnly, true)
assert.equal(empty.legalCorpusStatus, 'LEGAL_SUMMARIES_ONLY')
assert.equal(empty.experienceQuality, 'INSUFFICIENT_DATA')
assert.equal(empty.topHistoricalBlockers[0]?.reason, 'BLOCKED_NO_RETEST_FAILURE')

const bars = [
  ...generateDay('2026-06-08', 7350),
  ...generateDay('2026-06-09', 7370),
  ...generateDay('2026-06-10', 7390),
]

const experience = buildTraderVideoExperienceAgent({
  bars,
  lookbackDays: 10,
  now: new Date('2026-06-11T15:00:00.000Z'),
  observations: [observation],
  officialBrokerSymbol: 'SP500.',
  officialSymbol: 'SP500',
})

assert(experience.barsAnalyzed >= 1000, 'Debe revisar las barras historicas disponibles.')
assert(experience.possibleEntriesReviewed > 0, 'Debe revisar ventanas donde habria podido haber entrada.')
assert(experience.lessons.some((lesson) => lesson.includes('advisory-only')), 'La experiencia no debe autorizar trades.')
assert(['OBSERVING', 'EXPERIENCE_READY'].includes(experience.experienceQuality), 'Con suficientes barras debe pasar a observacion/experiencia.')

console.log('trader-video-experience-agent ok')
