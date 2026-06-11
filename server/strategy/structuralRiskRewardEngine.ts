import type { ProfessionalOpeningLevels, TrappedTraderResult } from './trappedTraderDetector.js'

export type StructuralRiskRewardDecision = {
  blockers: string[]
  costToTargetRatio: number
  decision: 'APPROVED' | 'BLOCKED'
  entryPrice: number
  expectedNetProfit: number
  reason: string
  riskRewardRatio: number
  stopDistance: number
  structuralTarget: number | null
  targetDistance: number
  targetNetUsd: number
  technicalStop: number | null
}

export const MIN_STRUCTURAL_RISK_REWARD = 2

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function targetCandidates(side: 'LONG' | 'SHORT', entryPrice: number, levels: ProfessionalOpeningLevels) {
  return side === 'SHORT'
    ? [levels.openingRangeLow, levels.overnightLow, levels.previousDayLow, levels.sessionLow]
      .filter((level): level is number => finite(level) && level < entryPrice)
      .sort((left, right) => right - left)
    : [levels.openingRangeHigh, levels.overnightHigh, levels.previousDayHigh, levels.sessionHigh]
      .filter((level): level is number => finite(level) && level > entryPrice)
      .sort((left, right) => left - right)
}

export function evaluateStructuralRiskReward(input: {
  entryPrice: number
  estimatedCostUsd?: number
  levels: ProfessionalOpeningLevels
  notionalUsd?: number
  side: 'LONG' | 'SHORT'
  spreadBps?: number | null
  structuralTarget?: number | null
  trap: TrappedTraderResult
}): StructuralRiskRewardDecision {
  const blockers: string[] = []
  const entryPrice = input.entryPrice
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) blockers.push('ENTRY_PRICE_INVALIDO')

  const fallbackBuffer = Math.max(entryPrice * 0.00035, 0.0001)
  const technicalStop = finite(input.trap.likelyStopZone)
    ? input.trap.likelyStopZone
    : input.side === 'SHORT'
      ? (input.trap.failedLevelPrice ?? entryPrice) + fallbackBuffer
      : (input.trap.failedLevelPrice ?? entryPrice) - fallbackBuffer
  if (!finite(technicalStop) || technicalStop <= 0) blockers.push('NO_TECHNICAL_STOP')

  const computedTargets = targetCandidates(input.side, entryPrice, input.levels)
  const stopForTarget = finite(technicalStop) ? Math.abs(technicalStop - entryPrice) : 0
  const target = finite(input.structuralTarget)
    ? input.structuralTarget
    : computedTargets.find((candidate) => stopForTarget > 0 && Math.abs(entryPrice - candidate) / stopForTarget >= MIN_STRUCTURAL_RISK_REWARD)
      ?? computedTargets[0]
      ?? null
  if (!finite(target)) blockers.push('NO_STRUCTURAL_TARGET')

  const stopDistance = finite(technicalStop) ? Math.abs(technicalStop - entryPrice) : 0
  const targetDistance = finite(target) ? Math.abs(entryPrice - target) : 0
  if (stopDistance <= 0) blockers.push('STOP_DISTANCE_INVALIDA')
  if (targetDistance <= 0) blockers.push('TARGET_DISTANCE_INVALIDA')
  if (input.side === 'SHORT' && finite(target) && target >= entryPrice) blockers.push('TARGET_NO_ESTA_DEBAJO_DE_SHORT')
  if (input.side === 'LONG' && finite(target) && target <= entryPrice) blockers.push('TARGET_NO_ESTA_ENCIMA_DE_LONG')

  const riskRewardRatio = stopDistance > 0 ? targetDistance / stopDistance : 0
  if (riskRewardRatio < MIN_STRUCTURAL_RISK_REWARD) blockers.push(`BAD_RISK_REWARD: RR ${round(riskRewardRatio, 2)} < ${MIN_STRUCTURAL_RISK_REWARD}.`)

  const notionalUsd = input.notionalUsd ?? 50
  const grossTargetUsd = entryPrice > 0 ? targetDistance / entryPrice * notionalUsd : 0
  const spreadCostUsd = entryPrice > 0 && finite(input.spreadBps)
    ? (input.spreadBps / 10_000) * notionalUsd
    : 0
  const estimatedCostUsd = input.estimatedCostUsd ?? spreadCostUsd
  const costToTargetRatio = grossTargetUsd > 0 ? estimatedCostUsd / grossTargetUsd : 1
  if (costToTargetRatio > 0.30) blockers.push(`COST_TOO_HIGH: costo ${(costToTargetRatio * 100).toFixed(1)}% del target > 30%.`)

  const expectedNetProfit = grossTargetUsd - estimatedCostUsd
  if (expectedNetProfit <= 0) blockers.push('EXPECTED_NET_PROFIT_NO_POSITIVO')

  return {
    blockers,
    costToTargetRatio: round(costToTargetRatio, 4),
    decision: blockers.length ? 'BLOCKED' : 'APPROVED',
    entryPrice,
    expectedNetProfit: round(expectedNetProfit, 4),
    reason: blockers[0] ?? `RR estructural ${round(riskRewardRatio, 2)} con target neto estimado ${round(expectedNetProfit, 4)}.`,
    riskRewardRatio: round(riskRewardRatio, 3),
    stopDistance: round(stopDistance, 6),
    structuralTarget: finite(target) ? target : null,
    targetDistance: round(targetDistance, 6),
    targetNetUsd: round(grossTargetUsd, 4),
    technicalStop: finite(technicalStop) ? technicalStop : null,
  }
}
