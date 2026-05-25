import { getMicroProfitTargetNetUsd } from '../config/microProfitConfig.js'
import { getShadowLearningEvidenceFor } from '../learning/weekendLearningCampaign.js'
import type { AgentEffectivenessStatus } from '../performance/agentEffectivenessEngine.js'
import type { SymbolDiagnostic } from '../performance/lossAttributionEngine.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'

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

function moveMultiple(opportunity: Opportunity) {
  if (!opportunity.edgeRequiredMoveBps || opportunity.edgeRequiredMoveBps <= 0) {
    return opportunity.source === 'BINANCE_REALTIME' || opportunity.assetClass === 'CRYPTO_CFD' ? 1.1 : 0
  }
  return Math.abs(opportunity.edgeMoveBps ?? 0) / opportunity.edgeRequiredMoveBps
}

function liveFeed(opportunity: Opportunity) {
  return opportunity.quote.feedType === 'BROKER_DEMO_REALTIME' || opportunity.quote.feedType === 'REALTIME_TICK'
}

function confirmed(opportunity: Opportunity) {
  return opportunity.setupConfirmed && (opportunity.setupStatus === 'CONFIRMED' || opportunity.setupStatus === 'EDGE_CONFIRMED' || opportunity.setupStatus === 'CONTROLLED_PROBE')
}

export function evidenceProtectionActive(effectiveness: EffectivenessLike) {
  const poorTenTradeSample = effectiveness.closedToday >= 10
    && effectiveness.netProfitToday < 0
    && (effectiveness.profitFactor ?? 0) < 1
    && effectiveness.expectedPayoff <= 0
  const failedTargetCampaign = effectiveness.closedToday >= 5
    && effectiveness.targetHitsToday === 0
    && effectiveness.netProfitToday < -2
  const badExitDominant = effectiveness.closedToday >= 5
    && effectiveness.netProfitToday < 0
    && ['MICRO_TIME_STOP', 'THESIS_INVALIDATED', 'THESIS_LOST_NO_EDGE', 'CRYPTO_FAST_INVALIDATION'].includes(effectiveness.principalClosureReason ?? '')
  return poorTenTradeSample || failedTargetCampaign || badExitDominant || effectiveness.status === 'INEFFICIENT'
}

export function validateEvidenceFirstMainPaperGate(input: {
  allowLearningScout?: boolean
  attribution: AttributionLike
  effectiveness: EffectivenessLike
  opportunity: Opportunity
}) {
  const target = getMicroProfitTargetNetUsd()
  const active = evidenceProtectionActive(input.effectiveness)
  const opportunity = input.opportunity
  const shadowEvidence = getShadowLearningEvidenceFor({
    cfdSymbol: opportunity.cfdSymbol,
    direction: opportunity.direction,
    strategy: opportunity.strategy,
  })
  if (!active) {
    return {
      active,
      approved: true,
      evidence: shadowEvidence,
      reason: 'Evidence gate normal: aun no hay patron perdedor suficiente para limitar main paper.',
      shadowLearningRecommended: false,
    }
  }

  const symbolMemory = input.attribution.symbolDiagnostics.find((item) => item.symbol === opportunity.cfdSymbol)
  const strategyMemory = input.attribution.worstStrategies.find((item) => item.name === opportunity.strategy)
  const score = opportunity.opportunityScore ?? 0
  const cfdScore = opportunity.cfdExpertScore ?? 0
  const signal = candleSignal(opportunity)
  const candle = candleScore(opportunity)
  const expected = opportunity.expectedNetProfit ?? 0
  const multiple = moveMultiple(opportunity)
  const isCrypto = opportunity.source === 'BINANCE_REALTIME' || opportunity.assetClass === 'CRYPTO_CFD'
  const positiveShadow = shadowEvidence.samples >= 8
    && shadowEvidence.netPnl > 0.5
    && shadowEvidence.expectedPayoff > 0
    && (shadowEvidence.targetHits >= 1 || shadowEvidence.winRate >= 55)
  const badShadow = shadowEvidence.samples >= 8
    && (shadowEvidence.netPnl < 0 || (shadowEvidence.targetHits === 0 && shadowEvidence.winRate < 35))
  const learningScout = Boolean(input.allowLearningScout
    && liveFeed(opportunity)
    && ['CONTROLLED_PROBE', 'LEARNING_ESCAPE_PROBE'].includes(opportunity.setupStatus)
    && signal !== 'BLOCKS_ENTRY'
    && score >= (isCrypto ? 84 : 88)
    && cfdScore >= (isCrypto ? 82 : 84)
    && candle >= (isCrypto && opportunity.setupStatus === 'LEARNING_ESCAPE_PROBE' ? 50 : isCrypto ? 70 : 68)
    && expected >= target * (isCrypto ? 0.75 : 1)
    && (opportunity.riskReward ?? 0) >= 2)
  const recoveryScout = Boolean(input.allowLearningScout
    && liveFeed(opportunity)
    && confirmed(opportunity)
    && signal !== 'BLOCKS_ENTRY'
    && score >= (isCrypto ? 90 : 88)
    && cfdScore >= (isCrypto ? 86 : 86)
    && candle >= (isCrypto ? 70 : 40)
    && expected >= target * (isCrypto ? 1 : 1.5)
    && (opportunity.riskReward ?? 0) >= 2
    && (isCrypto || multiple >= 1))
  const scoutApproved = learningScout || recoveryScout
  const ultraEliteUnproven = liveFeed(opportunity)
    && confirmed(opportunity)
    && signal !== 'BLOCKS_ENTRY'
    && score >= (isCrypto ? 98 : 97)
    && cfdScore >= (isCrypto ? 96 : 95)
    && candle >= (isCrypto ? 84 : 82)
    && expected >= target * 2.5
    && (opportunity.riskReward ?? 0) >= 2.2
    && (isCrypto || (multiple >= 3 && (opportunity.edgePersistence ?? 0) >= 0.84 && (opportunity.edgeEfficiency ?? 0) >= 0.72))
  const evidenceBackedSetup = positiveShadow
    && liveFeed(opportunity)
    && confirmed(opportunity)
    && signal !== 'BLOCKS_ENTRY'
    && score >= 92
    && cfdScore >= 90
    && candle >= 76
    && expected >= target * 1.75
    && (isCrypto || multiple >= 1.8)

  const reasons: string[] = []
  if (!liveFeed(opportunity)) reasons.push('feed no es dinamico/live para main paper')
  if (!confirmed(opportunity)) reasons.push(`setup no confirmado (${opportunity.setupStatus})`)
  if (signal === 'BLOCKS_ENTRY') reasons.push('vela cerrada bloquea la entrada')
  if (symbolMemory && ['SUSPEND', 'BAN_FOR_SESSION'].includes(symbolMemory.status)) {
    reasons.push(`simbolo con memoria negativa (${symbolMemory.status}, net $${symbolMemory.netPnl.toFixed(2)})`)
  }
  if (strategyMemory && strategyMemory.netPnl < -3) {
    reasons.push(`estrategia con perdida reciente $${Math.abs(strategyMemory.netPnl).toFixed(2)}`)
  }
  if (badShadow && !scoutApproved) {
    reasons.push(`shadow learning aun no valida ${opportunity.cfdSymbol}: ${shadowEvidence.samples} muestras, net $${shadowEvidence.netPnl}, hit rate ${shadowEvidence.targetHitRate}%`)
  }
  if (!positiveShadow && !ultraEliteUnproven && !scoutApproved) {
    reasons.push(`sin evidencia positiva: ${shadowEvidence.samples} muestras shadow, ${shadowEvidence.targetHits} targets, expected $${shadowEvidence.expectedPayoff}`)
  }
  if (!evidenceBackedSetup && !ultraEliteUnproven && !scoutApproved) {
    reasons.push(`calidad insuficiente para recovery: score ${score.toFixed(0)}, CFD ${cfdScore.toFixed(0)}, vela ${candle.toFixed(0)}, expected $${expected.toFixed(2)}, move ${multiple.toFixed(2)}x`)
  }

  const approved = (evidenceBackedSetup || ultraEliteUnproven || scoutApproved)
    && (!badShadow || scoutApproved)
    && !(symbolMemory && symbolMemory.status === 'BAN_FOR_SESSION' && (!scoutApproved || !isCrypto))
    && !(strategyMemory && strategyMemory.netPnl < -6 && !ultraEliteUnproven && !scoutApproved)

  return {
    active,
    approved,
    evidence: shadowEvidence,
    reason: approved
      ? positiveShadow
        ? `Evidence gate aprueba main paper: shadow positivo en ${opportunity.cfdSymbol} (${shadowEvidence.samples} muestras, ${shadowEvidence.targetHits} targets, expected $${shadowEvidence.expectedPayoff}) y setup actual fuerte.`
        : recoveryScout
          ? `Evidence gate aprueba recovery scout en ${opportunity.cfdSymbol}: setup confirmado, feed vivo, vela fuerte y margen para medir edge en main paper controlado.`
        : learningScout
          ? `Evidence gate aprueba learning scout en ${opportunity.cfdSymbol}: feed vivo, vela no bloqueante y watchdog evita quedarse paralizado; se mide en main paper controlado.`
          : `Evidence gate aprueba solo por ultra-elite: setup excepcional pese a falta de evidencia shadow positiva.`
      : `Evidence gate mueve ${opportunity.cfdSymbol} a aprendizaje shadow: ${reasons.join('; ')}.`,
    shadowLearningRecommended: !approved,
  }
}
