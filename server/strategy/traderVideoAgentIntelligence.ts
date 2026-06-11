import { buildChartNarrative, type ChartNarrativeStatus } from './chartNarrativeEngine.js'
import { analyzeCandleTrendContext, type CandleTrendContextStatus } from './candleTrendContextEngine.js'
import { auditFalsePositiveFalseNegative, type FalsePositiveFalseNegativeAuditStatus } from './falsePositiveFalseNegativeAudit.js'
import { buildMethodLearningScore, type MethodLearningScoreStatus } from './methodLearningScore.js'
import { auditTraderVideoAgentReadiness, type TraderVideoAgentReadinessAuditStatus } from './traderVideoAgentReadinessAudit.js'
import { buildTraderVideoExperienceAgent, type TraderVideoExperienceAgentStatus } from './traderVideoExperienceAgent.js'
import { runTraderVideoScenarioSimulation, type TraderVideoScenarioSimulationStatus } from './traderVideoScenarioSimulator.js'
import { analyzeSetupReplay, type SetupReplayAnalyzerStatus } from './setupReplayAnalyzer.js'
import { buildTraderVideoMethodDoctrine, type TraderVideoMethodDoctrineStatus } from './traderVideoMethodDoctrine.js'
import { buildTraderVideoLearningCorpus, type TraderVideoLearningCorpusStatus } from './traderVideoLearningCorpus.js'
import { buildTraderVideoMorningBrief, type TraderVideoMorningBriefStatus } from './traderVideoMorningBrief.js'
import { buildTraderVideoSetupObservation, getTraderVideoSetupJournal, recordTraderVideoSetupObservation, type TraderVideoSetupJournalStatus } from './traderVideoSetupJournal.js'
import type { ProfessionalOpeningBar } from './trappedTraderDetector.js'
import type { TraderVideoReplicationStatus } from './traderVideoReplicationMode.js'

export type TraderVideoAgentIntelligenceStatus = {
  candleTrendContext: CandleTrendContextStatus
  chartNarrative: ChartNarrativeStatus
  falsePositiveFalseNegativeAudit: FalsePositiveFalseNegativeAuditStatus
  experienceAgent: TraderVideoExperienceAgentStatus
  learningScore: MethodLearningScoreStatus
  learningCorpus: TraderVideoLearningCorpusStatus
  methodDoctrine: TraderVideoMethodDoctrineStatus
  morningBrief: TraderVideoMorningBriefStatus
  mode: 'TRADER_VIDEO_AGENT_INTELLIGENCE'
  readinessAudit: TraderVideoAgentReadinessAuditStatus
  replay: SetupReplayAnalyzerStatus
  scenarioSimulation: TraderVideoScenarioSimulationStatus
  setupJournal: TraderVideoSetupJournalStatus
  timestamp: string
}

export function buildTraderVideoAgentIntelligence(input: {
  bars?: ProfessionalOpeningBar[]
  experienceBars?: ProfessionalOpeningBar[]
  now?: Date
  recordObservation?: boolean
  traderVideoReplicationMode: TraderVideoReplicationStatus
}): TraderVideoAgentIntelligenceStatus {
  const now = input.now ?? new Date()
  const candleTrendContext = analyzeCandleTrendContext({
    bars: input.bars,
    now,
    status: input.traderVideoReplicationMode,
  })
  const chartNarrative = buildChartNarrative(input.traderVideoReplicationMode, now)
  const methodDoctrine = buildTraderVideoMethodDoctrine({
    now,
    status: input.traderVideoReplicationMode,
  })
  const morningBrief = buildTraderVideoMorningBrief(now)
  const learningCorpus = buildTraderVideoLearningCorpus(now)
  if (input.recordObservation !== false) {
    recordTraderVideoSetupObservation(buildTraderVideoSetupObservation({
      narrative: chartNarrative,
      now,
      status: input.traderVideoReplicationMode,
    }))
  }
  const setupJournal = getTraderVideoSetupJournal(80, { now, recentDays: 3 })
  const experienceAgent = buildTraderVideoExperienceAgent({
    bars: input.experienceBars ?? input.bars,
    now,
    observations: setupJournal.observations,
    officialBrokerSymbol: input.traderVideoReplicationMode.candidate?.brokerSymbol ?? input.traderVideoReplicationMode.symbol,
    officialSymbol: input.traderVideoReplicationMode.symbol,
  })
  const replay = analyzeSetupReplay(setupJournal.observations)
  const falsePositiveFalseNegativeAudit = auditFalsePositiveFalseNegative(setupJournal.observations)
  const learningScore = buildMethodLearningScore({
    audit: falsePositiveFalseNegativeAudit,
    doctrine: methodDoctrine,
    journal: setupJournal,
    narrative: chartNarrative,
    replay,
  })
  const readinessAudit = auditTraderVideoAgentReadiness({
    corpus: learningCorpus,
    doctrine: methodDoctrine,
    journal: setupJournal,
    learningScore,
    now,
  })
  const scenarioSimulation = runTraderVideoScenarioSimulation(now)
  return {
    candleTrendContext,
    chartNarrative,
    experienceAgent,
    falsePositiveFalseNegativeAudit,
    learningScore,
    learningCorpus,
    methodDoctrine,
    morningBrief,
    mode: 'TRADER_VIDEO_AGENT_INTELLIGENCE',
    readinessAudit,
    replay,
    scenarioSimulation,
    setupJournal,
    timestamp: now.toISOString(),
  }
}
