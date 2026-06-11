import { evaluateStructuralRiskReward, type StructuralRiskRewardDecision } from './structuralRiskRewardEngine.js'
import type { ProfessionalOpeningLevels, TrappedTraderResult } from './trappedTraderDetector.js'

export type RedGreenRiskBox = {
  greenBoxReward: number
  redBoxRisk: number
  riskReward: StructuralRiskRewardDecision
  state:
    | 'BUILDING_RED_GREEN_BOX'
    | 'VALID_RED_GREEN_BOX'
    | 'BLOCKED_BAD_RED_GREEN_RATIO'
    | 'BLOCKED_BAD_RR'
    | 'BLOCKED_COST_TOO_HIGH'
    | 'BLOCKED_NO_STRUCTURAL_TARGET'
  structuralTarget: number | null
  technicalStop: number | null
}

export function buildRedGreenRiskBox(input: {
  entryPrice: number
  levels: ProfessionalOpeningLevels
  side: 'LONG' | 'SHORT'
  spreadBps?: number | null
  trap: TrappedTraderResult
}): RedGreenRiskBox {
  const riskReward = evaluateStructuralRiskReward(input)
  const state = riskReward.decision === 'APPROVED'
    ? 'VALID_RED_GREEN_BOX'
    : riskReward.blockers.some((blocker) => blocker.includes('NO_STRUCTURAL_TARGET'))
      ? 'BLOCKED_NO_STRUCTURAL_TARGET'
      : riskReward.blockers.some((blocker) => blocker.includes('COST'))
        ? 'BLOCKED_COST_TOO_HIGH'
        : riskReward.blockers.some((blocker) => blocker.includes('BAD_RISK_REWARD'))
          ? 'BLOCKED_BAD_RR'
          : 'BLOCKED_BAD_RED_GREEN_RATIO'
  return {
    greenBoxReward: riskReward.targetDistance,
    redBoxRisk: riskReward.stopDistance,
    riskReward,
    state,
    structuralTarget: riskReward.structuralTarget,
    technicalStop: riskReward.technicalStop,
  }
}
