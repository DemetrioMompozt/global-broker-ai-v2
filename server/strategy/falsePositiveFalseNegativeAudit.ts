import type { TraderVideoSetupObservation } from './traderVideoSetupJournal.js'

export type FalsePositiveFalseNegativeAuditStatus = {
  falseNegativeCandidates: number
  falsePositiveCandidates: number
  outcomeLinkedSetups: number
  status: 'NO_OUTCOME_DATA' | 'WATCHING' | 'AUDITABLE'
  warning: string
}

export function auditFalsePositiveFalseNegative(observations: TraderVideoSetupObservation[]): FalsePositiveFalseNegativeAuditStatus {
  const recent = observations.slice(0, 200)
  const withOutcome = recent.filter((item) => item.outcome.status === 'PAPER_CLOSED' && typeof item.outcome.pnlUsd === 'number')
  const falsePositiveCandidates = withOutcome.filter((item) =>
    (item.analyticalDecision === 'GOOD_ENTRY' || item.analyticalDecision === 'ACCEPTABLE_ENTRY')
    && Number(item.outcome.pnlUsd) < 0,
  ).length
  const falseNegativeCandidates = withOutcome.filter((item) =>
    item.analyticalDecision === 'NO_TRADE'
    && item.markInteractionScore >= 70
    && Number(item.outcome.pnlUsd) > 0,
  ).length
  const status = withOutcome.length >= 30
    ? 'AUDITABLE'
    : withOutcome.length > 0
      ? 'WATCHING'
      : 'NO_OUTCOME_DATA'
  return {
    falseNegativeCandidates,
    falsePositiveCandidates,
    outcomeLinkedSetups: withOutcome.length,
    status,
    warning: status === 'NO_OUTCOME_DATA'
      ? 'Todavia no hay suficientes setups enlazados con resultado posterior; no se permite aprendizaje fuerte.'
      : 'Auditoria compara decisiones contra resultado paper cerrado; no cambia reglas automaticamente.',
  }
}
