import { getMicroProfitTargetNetUsd } from '../config/microProfitConfig.js'
import type { AgentEffectivenessStatus } from '../performance/agentEffectivenessEngine.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'
import { getClosedTrades } from '../storage/tradeStore.js'

type RecoveryInput = {
  effectiveness: {
    closedToday: number
    expectedPayoff: number
    netProfitToday: number
    principalClosureReason: string | null
    profitFactor: number | null
    status: AgentEffectivenessStatus
    targetHitsToday: number
  }
  opportunity: Opportunity
}

function todayClosedTrades() {
  const today = new Date().toISOString().slice(0, 10)
  return getClosedTrades().filter((trade) => trade.closedAt.startsWith(today))
}

function lossesForSymbol(symbol: string) {
  return todayClosedTrades().filter((trade) => trade.cfdSymbol === symbol && trade.pnl < 0)
}

export function isRecoveryMode(effectiveness: RecoveryInput['effectiveness']) {
  return effectiveness.status === 'INEFFICIENT'
    || effectiveness.status === 'WEAK'
    || effectiveness.status === 'CORRECTIVE'
    || (effectiveness.closedToday >= 12 && effectiveness.expectedPayoff < 0)
}

export function recoveryCandidateThresholds(effectiveness: RecoveryInput['effectiveness']) {
  if (effectiveness.status === 'INEFFICIENT') {
    return {
      minExpertScore: 90,
      minExpectedNetProfit: getMicroProfitTargetNetUsd() * 1.75,
      minMoveMultiple: 1.8,
      minOpportunityScore: 92,
      minPersistence: 0.68,
      minEfficiency: 0.45,
    }
  }
  if (effectiveness.status === 'WEAK' || effectiveness.status === 'CORRECTIVE') {
    return {
      minExpertScore: 88,
      minExpectedNetProfit: getMicroProfitTargetNetUsd() * 1.5,
      minMoveMultiple: 1.45,
      minOpportunityScore: 90,
      minPersistence: 0.64,
      minEfficiency: 0.38,
    }
  }
  return {
    minExpertScore: 82,
    minExpectedNetProfit: getMicroProfitTargetNetUsd(),
    minMoveMultiple: 1,
    minOpportunityScore: 85,
    minPersistence: 0.58,
    minEfficiency: 0.25,
  }
}

export function validateRecoveryCandidate(input: RecoveryInput) {
  if (!isRecoveryMode(input.effectiveness)) {
    return { approved: true, reason: 'Modo normal: recovery guard no aplica.' }
  }

  const thresholds = recoveryCandidateThresholds(input.effectiveness)
  const opportunity = input.opportunity
  const reasons: string[] = []
  const symbolLosses = lossesForSymbol(opportunity.cfdSymbol)
  const moveMultiple = opportunity.edgeRequiredMoveBps && opportunity.edgeRequiredMoveBps > 0
    ? Math.abs(opportunity.edgeMoveBps ?? 0) / opportunity.edgeRequiredMoveBps
    : opportunity.source === 'BINANCE_REALTIME' ? 1 : 0

  if ((opportunity.opportunityScore ?? 0) < thresholds.minOpportunityScore) reasons.push(`score ${opportunity.opportunityScore.toFixed(0)} < ${thresholds.minOpportunityScore}`)
  if ((opportunity.cfdExpertScore ?? 0) < thresholds.minExpertScore) reasons.push(`CFD score ${(opportunity.cfdExpertScore ?? 0).toFixed(0)} < ${thresholds.minExpertScore}`)
  if ((opportunity.expectedNetProfit ?? 0) < thresholds.minExpectedNetProfit) reasons.push(`expected net $${(opportunity.expectedNetProfit ?? 0).toFixed(2)} < $${thresholds.minExpectedNetProfit.toFixed(2)}`)
  if (opportunity.source === 'VT_MARKETS_MT5_DEMO') {
    if ((opportunity.edgePersistence ?? 0) < thresholds.minPersistence) reasons.push(`persistencia ${(((opportunity.edgePersistence ?? 0) * 100)).toFixed(0)}% < ${(thresholds.minPersistence * 100).toFixed(0)}%`)
    if ((opportunity.edgeEfficiency ?? 0) < thresholds.minEfficiency) reasons.push(`eficiencia ${(((opportunity.edgeEfficiency ?? 0) * 100)).toFixed(0)}% < ${(thresholds.minEfficiency * 100).toFixed(0)}%`)
    if (moveMultiple < thresholds.minMoveMultiple) reasons.push(`movimiento ${moveMultiple.toFixed(2)}x < ${thresholds.minMoveMultiple.toFixed(2)}x requerido`)
  }
  if (symbolLosses.length >= 2 && input.effectiveness.targetHitsToday < 2) reasons.push(`${opportunity.cfdSymbol} ya tuvo ${symbolLosses.length} perdidas hoy sin suficientes targets`)
  if (input.effectiveness.principalClosureReason === 'THESIS_INVALIDATED' && opportunity.source === 'VT_MARKETS_MT5_DEMO' && moveMultiple < thresholds.minMoveMultiple + 0.4) {
    reasons.push('modo anti-THESIS_INVALIDATED exige edge mucho mas persistente antes de reentrar')
  }

  return {
    approved: reasons.length === 0,
    reason: reasons.length
      ? `Recovery guard bloquea ${opportunity.cfdSymbol}: ${reasons.join('; ')}.`
      : `Recovery guard aprueba entrada sniper en ${opportunity.cfdSymbol}: edge supera umbrales correctivos.`,
  }
}
