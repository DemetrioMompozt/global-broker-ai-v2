import { getMicroProfitTargetNetUsd } from '../config/microProfitConfig.js'
import { validateAdaptiveLearningGate } from '../performance/adaptiveLearningEngine.js'
import { buildLossAttribution } from '../performance/lossAttributionEngine.js'
import type { AccountSnapshot } from '../risk/accountHealthGuard.js'
import type { AgentEffectivenessStatus } from '../performance/agentEffectivenessEngine.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'
import type { CfdPosition } from '../storage/tradeStore.js'

type EffectivenessSnapshot = {
  closedToday: number
  expectedPayoff: number
  netProfitToday: number
  status: AgentEffectivenessStatus
}

function isSkillRepairMode(effectiveness: EffectivenessSnapshot) {
  return effectiveness.status === 'WEAK'
    || effectiveness.status === 'CORRECTIVE'
    || effectiveness.status === 'INEFFICIENT'
    || (effectiveness.closedToday >= 6 && effectiveness.expectedPayoff < 0)
}

function moveMultiple(opportunity: Opportunity) {
  if (!opportunity.edgeRequiredMoveBps || opportunity.edgeRequiredMoveBps <= 0) return opportunity.source === 'BINANCE_REALTIME' ? 1 : 0
  return Math.abs(opportunity.edgeMoveBps ?? 0) / opportunity.edgeRequiredMoveBps
}

function sameUsdTheme(position: CfdPosition, opportunity: Opportunity) {
  if (position.assetClass !== 'FOREX_CFD' || opportunity.assetClass !== 'FOREX_CFD') return false
  const majors = new Set(['EURUSD.cfd', 'GBPUSD.cfd', 'USDCHF.cfd', 'USDJPY.cfd'])
  return majors.has(position.cfdSymbol) && majors.has(opportunity.cfdSymbol) && position.direction === opportunity.direction
}

function strategyLoss(input: ReturnType<typeof buildLossAttribution>, strategy: string) {
  return input.worstStrategies.find((item) => item.name === strategy)
}

function directionLoss(input: ReturnType<typeof buildLossAttribution>, direction?: 'LONG' | 'SHORT') {
  if (!direction) return null
  return input.worstDirections.find((item) => item.name === direction)
}

export function validateTraderEntryGate(input: {
  account: AccountSnapshot
  effectiveness: EffectivenessSnapshot
  openPositions: CfdPosition[]
  opportunity: Opportunity
}) {
  const reasons: string[] = []
  const opportunity = input.opportunity
  const repairMode = isSkillRepairMode(input.effectiveness)
  const target = getMicroProfitTargetNetUsd()
  const cfdScore = opportunity.cfdExpertScore ?? 0
  const score = opportunity.opportunityScore ?? 0
  const expected = opportunity.expectedNetProfit ?? 0
  const attribution = buildLossAttribution()
  const learning = validateAdaptiveLearningGate(opportunity)
  const symbolMemory = attribution.symbolDiagnostics.find((item) => item.symbol === opportunity.cfdSymbol)
  const strategyMemory = strategyLoss(attribution, opportunity.strategy)
  const directionMemory = directionLoss(attribution, opportunity.direction)
  const marginWatch = input.account.marginLevel < 150 || input.account.freeMargin < input.account.equity * 0.12
  const sameAssetClassOpen = input.openPositions.filter((position) => position.assetClass === opportunity.assetClass).length
  const correlatedUsd = input.openPositions.some((position) => sameUsdTheme(position, opportunity))
  const multiple = moveMultiple(opportunity)
  const isVt = opportunity.source === 'VT_MARKETS_MT5_DEMO'
  const isCrypto = opportunity.source === 'BINANCE_REALTIME' || opportunity.assetClass === 'CRYPTO_CFD'
  const exceptionalReversal = score >= 96
    && cfdScore >= 94
    && multiple >= 2.5
    && (opportunity.edgePersistence ?? 0) >= 0.78
    && (opportunity.edgeEfficiency ?? 0) >= 0.65

  if (marginWatch && input.openPositions.length >= 3) {
    reasons.push(`margin watch: ${input.account.marginLevel.toFixed(0)}% con ${input.openPositions.length} posiciones; no crecer hasta liberar aire`)
  }
  if (opportunity.candleBehavior && typeof opportunity.candleBehavior === 'object' && 'signal' in opportunity.candleBehavior && opportunity.candleBehavior.signal === 'BLOCKS_ENTRY') {
    const candle = opportunity.candleBehavior as { reason?: string }
    reasons.push(`candle skill bloquea entrada: ${candle.reason ?? 'vela cerrada no confirma el setup'}`)
  }
  if (!learning.approved) reasons.push(learning.reason)

  if (symbolMemory?.status === 'BAN_FOR_SESSION') {
    reasons.push(`memoria trader: ${opportunity.cfdSymbol} baneado por sesion; net ${symbolMemory.netPnl.toFixed(2)}, PF ${symbolMemory.profitFactor ?? 0}`)
  } else if (symbolMemory?.status === 'SUSPEND' && !exceptionalReversal) {
    reasons.push(`memoria trader: ${opportunity.cfdSymbol} suspendido por perdidas recientes; exige reversal excepcional antes de reentrar`)
  }
  if (strategyMemory && strategyMemory.netPnl < -4 && !exceptionalReversal) {
    reasons.push(`memoria trader: estrategia ${opportunity.strategy} viene perdiendo $${Math.abs(strategyMemory.netPnl).toFixed(2)} hoy`)
  }
  if (directionMemory && directionMemory.netPnl < -10 && isVt && !exceptionalReversal) {
    reasons.push(`memoria trader: direccion ${opportunity.direction} viene perdiendo $${Math.abs(directionMemory.netPnl).toFixed(2)} hoy en VT`)
  }
  if (attribution.mainLossDriver === 'bad_entries' && isVt && !exceptionalReversal) {
    if (score < 94) reasons.push(`anti-bad-entry: score ${score.toFixed(0)} < 94`)
    if (cfdScore < 92) reasons.push(`anti-bad-entry: CFD score ${cfdScore.toFixed(0)} < 92`)
    if ((opportunity.edgePersistence ?? 0) < 0.72) reasons.push(`anti-bad-entry: persistencia ${(((opportunity.edgePersistence ?? 0) * 100)).toFixed(0)}% < 72%`)
    if ((opportunity.edgeEfficiency ?? 0) < 0.58) reasons.push(`anti-bad-entry: eficiencia ${(((opportunity.edgeEfficiency ?? 0) * 100)).toFixed(0)}% < 58%`)
    if (multiple < 2) reasons.push(`anti-bad-entry: movimiento ${multiple.toFixed(2)}x < 2.00x requerido`)
  }

  if (repairMode) {
    const minScore = isCrypto ? 86 : 90
    const minCfdScore = isCrypto ? 87 : 88
    const minExpected = isCrypto ? target * 1.3 : target * 1.7
    if (score < minScore) reasons.push(`skill repair: score ${score.toFixed(0)} < ${minScore}`)
    if (cfdScore < minCfdScore) reasons.push(`skill repair: CFD score ${cfdScore.toFixed(0)} < ${minCfdScore}`)
    if (expected < minExpected) reasons.push(`skill repair: expected net $${expected.toFixed(2)} < $${minExpected.toFixed(2)}`)
  } else {
    if (score < 86) reasons.push(`score ${score.toFixed(0)} < 86`)
    if (cfdScore < 82) reasons.push(`CFD score ${cfdScore.toFixed(0)} < 82`)
  }

  if (isVt) {
    const minPersistence = repairMode ? 0.68 : 0.5
    const minEfficiency = repairMode ? 0.5 : 0.22
    const minMoveMultiple = repairMode ? 1.8 : 1.1
    if ((opportunity.edgePersistence ?? 0) < minPersistence) reasons.push(`persistencia ${(((opportunity.edgePersistence ?? 0) * 100)).toFixed(0)}% < ${(minPersistence * 100).toFixed(0)}%`)
    if ((opportunity.edgeEfficiency ?? 0) < minEfficiency) reasons.push(`eficiencia ${(((opportunity.edgeEfficiency ?? 0) * 100)).toFixed(0)}% < ${(minEfficiency * 100).toFixed(0)}%`)
    if (multiple < minMoveMultiple) reasons.push(`movimiento ${multiple.toFixed(2)}x < ${minMoveMultiple.toFixed(2)}x`)
  }

  if (sameAssetClassOpen >= 3 && score < 92) reasons.push(`ya hay ${sameAssetClassOpen} posiciones de ${opportunity.assetClass}; exigir score >= 92`)
  if (correlatedUsd && repairMode) reasons.push('skill repair: evitar otra exposicion USD correlacionada en la misma direccion')

  return {
    approved: reasons.length === 0,
    reason: reasons.length
      ? `Trader skill gate bloquea ${opportunity.cfdSymbol}: ${reasons.join('; ')}.`
      : `Trader skill gate aprueba ${opportunity.cfdSymbol}: edge suficientemente fuerte para buscar $${target} netos.`,
    repairMode,
  }
}
