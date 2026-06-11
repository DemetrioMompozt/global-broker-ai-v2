import type { ChartNarrativeStatus } from './chartNarrativeEngine.js'
import type { FalsePositiveFalseNegativeAuditStatus } from './falsePositiveFalseNegativeAudit.js'
import type { SetupReplayAnalyzerStatus } from './setupReplayAnalyzer.js'
import type { TraderVideoMethodDoctrineStatus } from './traderVideoMethodDoctrine.js'
import type { TraderVideoSetupJournalStatus } from './traderVideoSetupJournal.js'

export type MethodLearningScoreStatus = {
  agentMaturity: 'RULE_BASED' | 'OBSERVING' | 'LEARNING' | 'VERIFIED'
  canLearnStrong: boolean
  memoryScore: number
  outcomeScore: number
  doctrineScore: number
  reasoningScore: number
  recommendation: 'KEEP_OBSERVING' | 'COLLECT_MORE_SETUPS' | 'REVIEW_FALSE_POSITIVES' | 'READY_FOR_SUPERVISED_TUNING'
  summary: string
  totalScore: number
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export function buildMethodLearningScore(input: {
  audit: FalsePositiveFalseNegativeAuditStatus
  doctrine?: TraderVideoMethodDoctrineStatus
  journal: TraderVideoSetupJournalStatus
  narrative: ChartNarrativeStatus
  replay: SetupReplayAnalyzerStatus
}): MethodLearningScoreStatus {
  const memoryScore = clamp(Math.min(100, input.journal.totalObservations * 2))
  const doctrineScore = clamp(input.doctrine?.methodKnowledgeScore ?? 0)
  const reasoningScore = clamp(input.narrative.confidence)
  const outcomeScore = clamp(Math.min(100, input.audit.outcomeLinkedSetups * 3.5))
  const totalScore = clamp(doctrineScore * 0.20 + memoryScore * 0.25 + reasoningScore * 0.25 + outcomeScore * 0.30)
  const canLearnStrong = input.audit.outcomeLinkedSetups >= 30 && input.replay.replayQuality === 'ACTIONABLE'
  const agentMaturity: MethodLearningScoreStatus['agentMaturity'] = canLearnStrong
    ? 'VERIFIED'
    : input.journal.totalObservations >= 50 && input.audit.outcomeLinkedSetups >= 10
      ? 'LEARNING'
      : input.journal.totalObservations >= 10
        ? 'OBSERVING'
        : 'RULE_BASED'
  const recommendation: MethodLearningScoreStatus['recommendation'] = canLearnStrong
    ? 'READY_FOR_SUPERVISED_TUNING'
    : input.audit.falsePositiveCandidates > 0
      ? 'REVIEW_FALSE_POSITIVES'
      : input.journal.totalObservations < 30
        ? 'COLLECT_MORE_SETUPS'
        : 'KEEP_OBSERVING'
  return {
    agentMaturity,
    canLearnStrong,
    doctrineScore: Math.round(doctrineScore),
    memoryScore: Math.round(memoryScore),
    outcomeScore: Math.round(outcomeScore),
    reasoningScore: Math.round(reasoningScore),
    recommendation,
    summary: canLearnStrong
      ? 'Hay suficiente memoria y resultados enlazados para proponer ajustes supervisados.'
      : `Metodo aprendido como doctrina operativa; aun no es aprendizaje fuerte: ${input.journal.totalObservations} observaciones, ${input.audit.outcomeLinkedSetups} resultados enlazados.`,
    totalScore: Math.round(totalScore),
  }
}
