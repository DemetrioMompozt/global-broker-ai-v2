import type { AgentEffectivenessStatus } from '../performance/agentEffectivenessEngine.js'
import type { SymbolDiagnostic } from '../performance/lossAttributionEngine.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'

export type LossPatternFirewallStatus = {
  active: boolean
  mode: 'NORMAL' | 'PATTERN_PROTECTION'
  blockedPattern: string | null
  reason: string
  mainPaperAllowed: boolean
  shadowLearningRecommended: boolean
}

type EffectivenessLike = {
  closedToday: number
  expectedPayoff: number
  netProfitToday: number
  principalClosureReason: string | null
  profitFactor: number | null
  status: AgentEffectivenessStatus
  targetHitsToday: number
}

type AttributionLike = {
  mainLossDriver: string
  symbolDiagnostics: SymbolDiagnostic[]
  worstStrategies: Array<{ name: string; netPnl: number; trades: number }>
}

function moveMultiple(opportunity: Opportunity) {
  if (!opportunity.edgeRequiredMoveBps || opportunity.edgeRequiredMoveBps <= 0) {
    return opportunity.source === 'BINANCE_REALTIME' || opportunity.assetClass === 'CRYPTO_CFD' ? 1 : 0
  }
  return Math.abs(opportunity.edgeMoveBps ?? 0) / opportunity.edgeRequiredMoveBps
}

function candleScore(opportunity: Opportunity) {
  const candle = opportunity.candleBehavior
  if (typeof candle === 'object' && candle && 'score' in candle && typeof candle.score === 'number') return candle.score
  return opportunity.candleBehaviorScore ?? 0
}

function candleSignal(opportunity: Opportunity) {
  const candle = opportunity.candleBehavior
  if (typeof candle === 'object' && candle && 'signal' in candle && typeof candle.signal === 'string') return candle.signal
  return null
}

function hasLivePaperFeed(opportunity: Opportunity) {
  const feedType = opportunity.quote?.feedType
  return feedType === 'BROKER_DEMO_REALTIME' || feedType === 'REALTIME_TICK'
}

function hasConfirmedSetup(opportunity: Opportunity) {
  return opportunity.setupConfirmed
    || opportunity.setupStatus === 'CONFIRMED'
    || opportunity.setupStatus === 'EDGE_CONFIRMED'
    || opportunity.setupStatus === 'CONTROLLED_PROBE'
    || opportunity.setupStatus === 'LEARNING_ESCAPE_PROBE'
}

function isExceptionalEnoughToRetry(opportunity: Opportunity) {
  const isCrypto = opportunity.source === 'BINANCE_REALTIME' || opportunity.assetClass === 'CRYPTO_CFD'
  const score = opportunity.opportunityScore ?? 0
  const cfdScore = opportunity.cfdExpertScore ?? 0
  const signal = candleSignal(opportunity)
  const candleAllowsEntry = signal !== 'BLOCKS_ENTRY'
  const eliteLiveSetup = hasLivePaperFeed(opportunity)
    && hasConfirmedSetup(opportunity)
    && candleAllowsEntry
    && score >= 95
    && cfdScore >= 92
    && (opportunity.expectedNetProfit ?? 0) >= 3.5
    && (opportunity.riskReward ?? 0) >= 2
    && candleScore(opportunity) >= 72

  if (eliteLiveSetup) return true

  if (isCrypto) {
    return score >= 97
      && cfdScore >= 94
      && candleScore(opportunity) >= 78
      && signal === 'CONFIRMS_ENTRY'
  }
  return score >= 96
    && cfdScore >= 93
    && moveMultiple(opportunity) >= 2.4
    && (opportunity.edgePersistence ?? 0) >= 0.78
    && (opportunity.edgeEfficiency ?? 0) >= 0.65
}

export function buildLossPatternFirewallStatus(input: {
  attribution: AttributionLike
  effectiveness: EffectivenessLike
}): LossPatternFirewallStatus {
  const repeatedCryptoInvalidation = input.effectiveness.closedToday >= 10
    && input.effectiveness.targetHitsToday === 0
    && input.effectiveness.principalClosureReason === 'CRYPTO_FAST_INVALIDATION'
  const ineffectivePattern = input.effectiveness.closedToday >= 10
    && input.effectiveness.netProfitToday < 0
    && (input.effectiveness.profitFactor ?? 0) < 1
    && input.effectiveness.expectedPayoff < 0

  if (repeatedCryptoInvalidation) {
    return {
      active: true,
      blockedPattern: 'CRYPTO_FAST_INVALIDATION',
      mainPaperAllowed: false,
      mode: 'PATTERN_PROTECTION',
      reason: 'El agente detecto 0 targets de $2 y cierre dominante CRYPTO_FAST_INVALIDATION. No repetira ese patron en main paper; lo mueve a aprendizaje shadow.',
      shadowLearningRecommended: true,
    }
  }

  if (ineffectivePattern) {
    return {
      active: true,
      blockedPattern: input.attribution.mainLossDriver,
      mainPaperAllowed: true,
      mode: 'PATTERN_PROTECTION',
      reason: 'Resultados negativos persistentes. Main paper solo permite entradas excepcionales y el resto se estudia en shadow.',
      shadowLearningRecommended: true,
    }
  }

  return {
    active: false,
    blockedPattern: null,
    mainPaperAllowed: true,
    mode: 'NORMAL',
    reason: 'Sin patron perdedor dominante que requiera firewall.',
    shadowLearningRecommended: false,
  }
}

export function validateLossPatternFirewall(input: {
  attribution: AttributionLike
  effectiveness: EffectivenessLike
  opportunity: Opportunity
}) {
  const status = buildLossPatternFirewallStatus(input)
  if (!status.active) return { approved: true, reason: status.reason, status }

  const isCrypto = input.opportunity.source === 'BINANCE_REALTIME' || input.opportunity.assetClass === 'CRYPTO_CFD'
  const symbolMemory = input.attribution.symbolDiagnostics.find((item) => item.symbol === input.opportunity.cfdSymbol)
  const strategyMemory = input.attribution.worstStrategies.find((item) => item.name === input.opportunity.strategy)
  const reasons: string[] = []

  if (isCrypto && input.effectiveness.principalClosureReason === 'CRYPTO_FAST_INVALIDATION') {
    if (candleSignal(input.opportunity) === 'BLOCKS_ENTRY') {
      reasons.push('cripto tiene vela contraria; no se abre hasta que la vela deje de bloquear')
    }
  }
  if (!isCrypto && symbolMemory && ['SUSPEND', 'BAN_FOR_SESSION'].includes(symbolMemory.status)) {
    reasons.push(`${input.opportunity.cfdSymbol} esta ${symbolMemory.status} por P/L ${symbolMemory.netPnl.toFixed(2)} y PF ${symbolMemory.profitFactor ?? 0}`)
  }
  if (!isCrypto && strategyMemory && strategyMemory.netPnl < -3) {
    reasons.push(`estrategia ${input.opportunity.strategy} viene perdiendo $${Math.abs(strategyMemory.netPnl).toFixed(2)} hoy`)
  }
  if (!isCrypto && input.attribution.mainLossDriver === 'weak_setup' && !isExceptionalEnoughToRetry(input.opportunity)) {
    reasons.push('driver weak_setup exige setup excepcional antes de volver a arriesgar main paper')
  }
  if (!isCrypto && input.attribution.mainLossDriver === 'bad_entries' && !isExceptionalEnoughToRetry(input.opportunity)) {
    reasons.push('driver bad_entries exige evidencia de vela y edge mucho mas fuerte')
  }

  if (reasons.length && !isExceptionalEnoughToRetry(input.opportunity)) {
    return {
      approved: false,
      reason: `Loss pattern firewall mueve ${input.opportunity.cfdSymbol} a shadow learning: ${reasons.join('; ')}.`,
      status,
    }
  }

  return {
    approved: true,
    reason: `Loss pattern firewall permite ${input.opportunity.cfdSymbol}: entrada elite con feed vivo, setup confirmado y edge suficiente pese al patron perdedor previo.`,
    status,
  }
}
