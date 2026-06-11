import fs from 'node:fs'
import path from 'node:path'
import type { ChartNarrativeStatus } from './chartNarrativeEngine.js'
import type { TraderVideoReplicationStatus } from './traderVideoReplicationMode.js'
import { newYorkDay } from './tradingTimezone.js'

export type TraderVideoSetupOutcome = {
  closeReason: string | null
  pnlUsd: number | null
  status: 'OBSERVED_ONLY' | 'PAPER_READY' | 'PAPER_OPENED' | 'PAPER_CLOSED' | 'EXPIRED_WITHOUT_ENTRY'
}

export type TraderVideoSetupObservation = {
  analyticalDecision: TraderVideoReplicationStatus['analyticalDecision']['finalDecision']
  bias: ChartNarrativeStatus['bias']
  blockedReasons: TraderVideoReplicationStatus['analyticalDecision']['blockedReasons']
  componentScores: TraderVideoReplicationStatus['analyticalDecision']['componentScores']
  confidence: number
  createdAt: string
  id: string
  institutionalPressure: TraderVideoReplicationStatus['institutionalPressure']
  markInteractionScore: number
  narrative: string
  nextRequiredCondition: string
  openingRangeHigh: number | null
  openingRangeLow: number | null
  outcome: TraderVideoSetupOutcome
  reason: string
  redGreenBox: {
    costToTargetRatio: number | null
    expectedNetProfit: number | null
    redBoxRisk: number | null
    greenBoxReward: number | null
    state: string | null
    structuralTarget: number | null
    targetNetUsd: number | null
    technicalStop: number | null
  }
  retestFailure: {
    canUseForEntry: boolean | null
    state: string | null
  }
  riskRewardRatio: number | null
  sessionDate: string
  state: TraderVideoReplicationStatus['state']
  symbol: string | null
  testedLevelName: string | null
  testedLevelPrice: number | null
  trappedSide: 'BUYERS' | 'SELLERS' | 'NONE'
  trendlineQuality: {
    anchorCount: number | null
    qualityScore: number | null
    role: string | null
    slopePerMinute: number | null
  }
  trendlineState: string | null
  weakCountermove: {
    counterMoveBars: number | null
    score: number | null
    state: string | null
  }
}

export type TraderVideoSetupJournalStatus = {
  journalPath: string
  lastObservation: TraderVideoSetupObservation | null
  observations: TraderVideoSetupObservation[]
  observationsToday: number
  totalStoredObservations: number
  totalObservations: number
  validationWindowDays: number
  validationWindowStart: string
}

const journalDir = path.join(process.cwd(), 'storage-data')
const journalPath = path.join(journalDir, 'trader-video-setup-journal.json')
const maxObservations = 800
const defaultValidationWindowDays = 3
const disabled = process.argv.some((argument) => argument.includes('/server/tests/') || argument.includes('\\server\\tests\\'))

let memory: TraderVideoSetupObservation[] = load()

function load() {
  try {
    if (disabled || !fs.existsSync(journalPath)) return []
    const parsed = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as { observations?: TraderVideoSetupObservation[] }
    return Array.isArray(parsed.observations) ? parsed.observations.filter(validObservation).map(normalizeObservation).slice(0, maxObservations) : []
  } catch {
    return []
  }
}

function persist() {
  try {
    if (disabled) return
    if (!fs.existsSync(journalDir)) fs.mkdirSync(journalDir, { recursive: true })
    fs.writeFileSync(journalPath, JSON.stringify({ observations: memory.slice(0, maxObservations) }, null, 2))
  } catch {
    // Learning persistence must never break live status.
  }
}

function validObservation(value: TraderVideoSetupObservation) {
  return Boolean(value && typeof value.id === 'string' && typeof value.createdAt === 'string')
}

function normalizeObservation(value: TraderVideoSetupObservation): TraderVideoSetupObservation {
  return {
    ...value,
    blockedReasons: value.blockedReasons ?? [],
    componentScores: value.componentScores ?? {
      contextScore: 0,
      dataConfidenceScore: 0,
      institutionalPressureScore: 0,
      markInteractionScore: value.markInteractionScore ?? 0,
      redGreenScore: 0,
      retestFailureScore: 0,
      trappedTraderScore: 0,
      trendlineQualityScore: 0,
      weakCountermoveScore: 0,
    },
    institutionalPressure: value.institutionalPressure ?? 'NEUTRAL',
    nextRequiredCondition: value.nextRequiredCondition ?? 'No disponible en observacion legacy.',
    redGreenBox: value.redGreenBox ?? {
      costToTargetRatio: null,
      expectedNetProfit: null,
      greenBoxReward: null,
      redBoxRisk: null,
      state: null,
      structuralTarget: null,
      targetNetUsd: null,
      technicalStop: null,
    },
    retestFailure: value.retestFailure ?? {
      canUseForEntry: null,
      state: value.trendlineState ?? null,
    },
    trendlineQuality: value.trendlineQuality ?? {
      anchorCount: null,
      qualityScore: null,
      role: null,
      slopePerMinute: null,
    },
    weakCountermove: value.weakCountermove ?? {
      counterMoveBars: null,
      score: null,
      state: null,
    },
  }
}

function minuteBucket(date: Date) {
  const copy = new Date(date)
  copy.setUTCSeconds(0, 0)
  return copy.toISOString()
}

function buildId(status: TraderVideoReplicationStatus, narrative: ChartNarrativeStatus, now: Date) {
  return [
    newYorkDay(now),
    status.symbol ?? 'NONE',
    status.state,
    status.analyticalDecision.finalDecision,
    narrative.markInteraction.levelName ?? 'NO_LEVEL',
    narrative.bias,
    minuteBucket(now),
  ].join('|')
}

export function buildTraderVideoSetupObservation(input: {
  narrative: ChartNarrativeStatus
  now?: Date
  status: TraderVideoReplicationStatus
}): TraderVideoSetupObservation {
  const now = input.now ?? new Date()
  const status = input.status
  const narrative = input.narrative
  return {
    analyticalDecision: status.analyticalDecision.finalDecision,
    bias: narrative.bias,
    blockedReasons: status.analyticalDecision.blockedReasons,
    componentScores: status.analyticalDecision.componentScores,
    confidence: narrative.confidence,
    createdAt: now.toISOString(),
    id: buildId(status, narrative, now),
    institutionalPressure: status.institutionalPressure,
    markInteractionScore: status.analyticalDecision.componentScores.markInteractionScore ?? 0,
    narrative: narrative.narrative,
    nextRequiredCondition: status.analyticalDecision.nextRequiredCondition,
    openingRangeHigh: status.openingRange.openingRangeHigh,
    openingRangeLow: status.openingRange.openingRangeLow,
    outcome: {
      closeReason: null,
      pnlUsd: null,
      status: status.finalDecision === 'READY_FOR_PAPER_ENTRY' ? 'PAPER_READY' : 'OBSERVED_ONLY',
    },
    reason: status.analyticalDecision.humanReasoning,
    redGreenBox: {
      costToTargetRatio: status.redGreenRiskBox?.riskReward.costToTargetRatio ?? null,
      expectedNetProfit: status.redGreenRiskBox?.riskReward.expectedNetProfit ?? null,
      greenBoxReward: status.redGreenRiskBox?.greenBoxReward ?? null,
      redBoxRisk: status.redGreenRiskBox?.redBoxRisk ?? null,
      state: status.redGreenRiskBox?.state ?? null,
      structuralTarget: status.redGreenRiskBox?.structuralTarget ?? null,
      targetNetUsd: status.redGreenRiskBox?.riskReward.targetNetUsd ?? null,
      technicalStop: status.redGreenRiskBox?.technicalStop ?? null,
    },
    retestFailure: {
      canUseForEntry: status.trendlineFailure?.canUseForEntry ?? status.weakCountermoveTrendline?.trendlineFailure?.canUseForEntry ?? null,
      state: status.trendlineFailure?.state ?? status.weakCountermoveTrendline?.trendlineFailure?.state ?? null,
    },
    riskRewardRatio: status.redGreenRiskBox?.riskReward.riskRewardRatio ?? null,
    sessionDate: newYorkDay(now),
    state: status.state,
    symbol: status.symbol,
    testedLevelName: narrative.markInteraction.levelName,
    testedLevelPrice: narrative.markInteraction.levelPrice,
    trappedSide: status.wrongSidedTrader?.trappedSide ?? status.weakCountermoveTrendline?.trappedSide ?? 'NONE',
    trendlineQuality: {
      anchorCount: status.trendlineFailure?.trendline?.anchorCount ?? status.weakCountermoveTrendline?.trendlineFailure?.trendline?.anchorCount ?? null,
      qualityScore: status.trendlineFailure?.trendline?.qualityScore ?? status.weakCountermoveTrendline?.trendlineFailure?.trendline?.qualityScore ?? null,
      role: status.trendlineFailure?.trendline?.role ?? status.weakCountermoveTrendline?.trendlineFailure?.trendline?.role ?? null,
      slopePerMinute: status.trendlineFailure?.trendline?.slopePerMinute ?? status.weakCountermoveTrendline?.trendlineFailure?.trendline?.slopePerMinute ?? null,
    },
    trendlineState: status.trendlineFailure?.state ?? null,
    weakCountermove: {
      counterMoveBars: status.weakCountermoveTrendline?.counterMoveBars ?? null,
      score: status.weakCountermoveTrendline?.weakCountermoveScore ?? null,
      state: status.weakCountermoveTrendline?.state ?? null,
    },
  }
}

export function recordTraderVideoSetupObservation(observation: TraderVideoSetupObservation) {
  if (memory[0]?.id === observation.id) return memory[0]
  const existingIndex = memory.findIndex((item) => item.id === observation.id)
  if (existingIndex >= 0) {
    memory[existingIndex] = observation
  } else {
    memory.unshift(observation)
  }
  memory = memory.slice(0, maxObservations)
  persist()
  return observation
}

function observationsInsideRecentWindow(input: {
  now: Date
  recentDays: number
  observations: TraderVideoSetupObservation[]
}) {
  const windowStart = new Date(input.now.getTime() - input.recentDays * 24 * 60 * 60 * 1000)
  return input.observations.filter((item) => {
    const createdAt = new Date(item.createdAt)
    return Number.isFinite(createdAt.getTime()) && createdAt >= windowStart
  })
}

export function getTraderVideoSetupJournal(limit = 100, options: {
  now?: Date
  recentDays?: number
} = {}): TraderVideoSetupJournalStatus {
  const now = options.now ?? new Date()
  const recentDays = Math.max(1, Math.floor(options.recentDays ?? defaultValidationWindowDays))
  const windowStart = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000)
  const recentMemory = observationsInsideRecentWindow({
    now,
    observations: memory,
    recentDays,
  })
  const today = newYorkDay(now)
  return {
    journalPath,
    lastObservation: recentMemory[0] ?? null,
    observations: recentMemory.slice(0, limit),
    observationsToday: recentMemory.filter((item) => item.sessionDate === today).length,
    totalObservations: recentMemory.length,
    totalStoredObservations: memory.length,
    validationWindowDays: recentDays,
    validationWindowStart: windowStart.toISOString(),
  }
}

export function resetTraderVideoSetupJournalForTests() {
  memory = []
}
