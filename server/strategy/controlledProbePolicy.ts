import { getMicroProfitTargetNetUsd } from '../config/microProfitConfig.js'
import type { AccountSnapshot } from '../risk/accountHealthGuard.js'
import type { CfdPosition } from '../storage/tradeStore.js'
import type { Opportunity } from './globalOpportunityScanner.js'

type CandleReadout = {
  available?: boolean
  candlesUsed?: number
  pattern?: string
  score?: number
  signal?: 'CONFIRMS_ENTRY' | 'BLOCKS_ENTRY' | 'NEUTRAL'
}

export type ControlledProbeDecision = {
  approved: boolean
  reason: string
  opportunity: Opportunity
}

function candle(opportunity: Opportunity): CandleReadout {
  return typeof opportunity.candleBehavior === 'object' && opportunity.candleBehavior
    ? opportunity.candleBehavior as CandleReadout
    : {}
}

function hasUsableLiveFeed(opportunity: Opportunity) {
  return ['REALTIME_TICK', 'BROKER_DEMO_REALTIME'].includes(opportunity.quote.feedType)
    && opportunity.quote.bid > 0
    && opportunity.quote.ask > opportunity.quote.bid
}

function isCryptoProbeEligible(opportunity: Opportunity, c: CandleReadout) {
  const score = opportunity.opportunityScore ?? 0
  const cfdScore = opportunity.cfdExpertScore ?? 0
  const candleScore = c.score ?? opportunity.candleBehaviorScore ?? 0
  const lastPriceAgeSeconds = Math.max(0, (Date.now() - new Date(opportunity.quote.lastPriceUpdate).getTime()) / 1000)
  const freshQuoteBootstrap = !c.available
    && (c.candlesUsed ?? 0) < 3
    && lastPriceAgeSeconds <= 90
    && score >= 79
    && cfdScore >= 78
  return opportunity.assetClass === 'CRYPTO_CFD'
    && opportunity.quote.feedType === 'REALTIME_TICK'
    && ['WAITING_FOR_CANDLES', 'SETUP_FORMING'].includes(opportunity.setupStatus)
    && score >= 79
    && cfdScore >= 78
    && (freshQuoteBootstrap || (candleScore >= 55 && (c.available || (c.candlesUsed ?? 0) >= 3)))
}

function isVtProbeEligible(opportunity: Opportunity, c: CandleReadout) {
  const score = opportunity.opportunityScore ?? 0
  const cfdScore = opportunity.cfdExpertScore ?? 0
  const moveMultiple = opportunity.edgeRequiredMoveBps && opportunity.edgeRequiredMoveBps > 0
    ? Math.abs(opportunity.edgeMoveBps ?? 0) / opportunity.edgeRequiredMoveBps
    : 0
  return opportunity.source === 'VT_MARKETS_MT5_DEMO'
    && opportunity.quote.feedType === 'BROKER_DEMO_REALTIME'
    && opportunity.setupStatus !== 'NO_DIRECTIONAL_EDGE'
    && score >= 78
    && cfdScore >= 72
    && (c.score ?? opportunity.candleBehaviorScore ?? 0) >= 52
    && moveMultiple >= 0.65
}

export function buildControlledProbeOpportunity(input: {
  account: AccountSnapshot
  openPositions: CfdPosition[]
  opportunity: Opportunity
}) : ControlledProbeDecision {
  const { account, openPositions, opportunity } = input
  const reasons: string[] = []
  const c = candle(opportunity)
  const target = getMicroProfitTargetNetUsd()

  if (opportunity.setupConfirmed) {
    return { approved: true, opportunity, reason: 'Setup confirmado; no requiere probe controlado.' }
  }
  if (openPositions.some((position) => position.cfdSymbol === opportunity.cfdSymbol)) reasons.push('ya existe posicion en el mismo CFD')
  if (!hasUsableLiveFeed(opportunity)) reasons.push('feed vivo no usable')
  if (account.marginLevel < 160 || account.freeMargin < account.equity * 0.15) reasons.push('margen insuficiente para probe controlado')
  if (c.signal === 'BLOCKS_ENTRY') reasons.push(`vela bloquea entrada: ${c.pattern ?? 'patron contrario'}`)
  if ((opportunity.expectedNetProfit ?? 0) < target) reasons.push(`expected net menor al target $${target}`)

  const cryptoEligible = isCryptoProbeEligible(opportunity, c)
  const vtEligible = isVtProbeEligible(opportunity, c)
  if (!cryptoEligible && !vtEligible) {
    const sourceReason = opportunity.source === 'VT_MARKETS_MT5_DEMO'
      ? 'VT exige movimiento direccional parcial; no abre cuando esta plano.'
      : 'Cripto exige score >=79, CFD >=78 y lectura de vela parcial no bloqueante o quote fresco de arranque.'
    reasons.push(sourceReason)
  }

  if (reasons.length) {
    return { approved: false, opportunity, reason: `Controlled probe bloquea ${opportunity.cfdSymbol}: ${reasons.join('; ')}.` }
  }

  const crypto = opportunity.assetClass === 'CRYPTO_CFD' || opportunity.source === 'BINANCE_REALTIME'
  return {
    approved: true,
    opportunity: {
      ...opportunity,
      cfdExpertScore: Math.max(opportunity.cfdExpertScore ?? 0, crypto ? 85 : 82),
      decision: 'APPROVED',
      opportunityScore: Math.max(opportunity.opportunityScore ?? 0, crypto ? 86 : 88),
      reason: `CONTROLLED_PROBE: entrada paper intermedia con feed vivo y vela no bloqueante. ${opportunity.reason}`,
      setupConfirmed: true,
      setupStatus: 'CONTROLLED_PROBE',
    },
    reason: crypto
      ? `Controlled probe aprueba ${opportunity.cfdSymbol}: Binance realtime, score parcial ${(opportunity.opportunityScore ?? 0).toFixed(0)}, vela ${c.pattern ?? 'parcial'} sin bloqueo.`
      : `Controlled probe aprueba ${opportunity.cfdSymbol}: VT tiene edge parcial y costos compatibles con el target.`,
  }
}
