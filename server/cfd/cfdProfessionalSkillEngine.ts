import type { AccountSnapshot } from '../risk/accountHealthGuard.js'
import type { MicroProfitCosts } from './microProfitEngine.js'
import type { CfdQuote } from './cfdPricingEngine.js'
import type { AssetClass } from '../symbols/cfdInstrumentRegistry.js'
import { getMicroProfitCostLimits } from '../config/microProfitConfig.js'

export type CfdProfessionalDecision = {
  approved: boolean
  decision: 'APPROVE' | 'BLOCK' | 'WAIT'
  disciplineScore: number
  minimumGrossProfitNeeded: number
  minimumMoveNeeded: number
  minimumMoveBps: number
  netTargetFeasible: boolean
  projectedFreeMargin: number
  projectedMarginLevel: number
  reason: string
  blockingReasons: string[]
  recommendations: string[]
}

export function evaluateCfdProfessionalSkill(input: {
  account: AccountSnapshot
  assetClass: AssetClass
  costs: MicroProfitCosts
  expectedNetProfit: number
  marginRequired: number
  positionSize: number
  quote: CfdQuote
  targetNetUsd: number
}) {
  const blockingReasons: string[] = []
  const recommendations: string[] = []
  const minimumGrossProfitNeeded = input.targetNetUsd + input.costs.spreadCost + input.costs.commission + input.costs.slippageEstimate + input.costs.swapAccrued
  const minimumMoveNeeded = input.positionSize > 0 ? minimumGrossProfitNeeded / input.positionSize : Infinity
  const minimumMoveBps = input.quote.mid > 0 ? minimumMoveNeeded / input.quote.mid * 10_000 : Infinity
  const projectedUsedMargin = input.account.usedMargin + input.marginRequired
  const projectedFreeMargin = input.account.equity - projectedUsedMargin
  const projectedMarginLevel = projectedUsedMargin > 0 ? input.account.equity / projectedUsedMargin * 100 : 9999
  const netTargetFeasible = input.expectedNetProfit >= input.targetNetUsd - 0.001
  const maxMarginShare = {
    CRYPTO_CFD: 0.55,
    EQUITY_CFD: 0.35,
    FOREX_CFD: 0.32,
    INDEX_CFD: 0.38,
    METAL_CFD: 0.35,
  }[input.assetClass] ?? 0.35
  const positionMarginShare = input.account.equity > 0 ? input.marginRequired / input.account.equity : Infinity
  const marginHealthy = projectedFreeMargin > input.account.equity * 0.15
    && projectedMarginLevel >= 140
    && positionMarginShare <= maxMarginShare
  const liveBidAsk = input.quote.pricingQuality === 'LIVE_BID_ASK' && input.quote.bid > 0 && input.quote.ask > input.quote.bid
  const dynamicEstimatedSpread = input.quote.pricingQuality === 'LIVE_MID_ESTIMATED_SPREAD'
    && input.quote.feedType === 'REALTIME_TICK'
    && input.quote.bid > 0
    && input.quote.ask > input.quote.bid
  const pricingProfessionallyUsable = liveBidAsk || dynamicEstimatedSpread
  const costLimits = getMicroProfitCostLimits(input.targetNetUsd)
  const spreadReasonable = input.costs.spreadCost <= costLimits.maxSpreadCostUsd
  const costReasonable = input.costs.totalEstimatedCost <= costLimits.maxTotalEstimatedCostUsd
  const movementCeilingBps = {
    CRYPTO_CFD: 70,
    EQUITY_CFD: 70,
    FOREX_CFD: 28,
    INDEX_CFD: 38,
    METAL_CFD: 45,
  }[input.assetClass] ?? 220
  const movementReasonable = Number.isFinite(minimumMoveBps) && minimumMoveBps <= movementCeilingBps

  if (!pricingProfessionallyUsable) blockingReasons.push('Sin precio CFD dinamico usable: requiere bid/ask vivo de VT o tick realtime con spread estimado conservador.')
  if (!marginHealthy) blockingReasons.push(`Margen post-entrada insuficiente: margin level ${projectedMarginLevel.toFixed(0)}%, free margin proyectado $${projectedFreeMargin.toFixed(2)}, margen de la posicion ${(positionMarginShare * 100).toFixed(0)}% del equity.`)
  if (!netTargetFeasible) blockingReasons.push(`Expected net profit menor al target neto $${input.targetNetUsd}.`)
  if (!spreadReasonable) blockingReasons.push(`Spread consume mas de $${costLimits.maxSpreadCostUsd.toFixed(2)} del target neto.`)
  if (!costReasonable) blockingReasons.push(`Costos totales consumen mas de $${costLimits.maxTotalEstimatedCostUsd.toFixed(2)} del target neto.`)
  if (!movementReasonable) blockingReasons.push(`Movimiento minimo requerido para $2 netos (${minimumMoveBps.toFixed(2)} bps) excede el rango profesional para ${input.assetClass}.`)

  if (minimumMoveBps > movementCeilingBps * 0.6) recommendations.push('Esperar mejor precio/spread o mayor conviccion si el movimiento minimo requerido se acerca al limite profesional.')
  if (projectedMarginLevel < 180 || positionMarginShare > maxMarginShare * 0.8) recommendations.push('No consumir demasiado margen para buscar $2; esperar mejor spread, mayor movimiento o menor tamano.')
  if (input.costs.costToProfitRatio > 0.2) recommendations.push('No perseguir micro-profit con costos altos; esperar setup mas limpio.')

  const disciplineScore = Math.max(0, Math.min(100,
    (liveBidAsk ? 25 : dynamicEstimatedSpread ? 18 : 0)
    + (marginHealthy ? 20 : 0)
    + (netTargetFeasible ? 25 : 0)
    + (spreadReasonable ? 10 : 0)
    + (costReasonable ? 10 : 0)
    + (movementReasonable ? 10 : 0)
  ))

  return {
    approved: blockingReasons.length === 0 && disciplineScore >= 80,
    blockingReasons,
    decision: blockingReasons.length ? 'BLOCK' as const : disciplineScore >= 80 ? 'APPROVE' as const : 'WAIT' as const,
    disciplineScore,
    minimumGrossProfitNeeded: Number(minimumGrossProfitNeeded.toFixed(6)),
    minimumMoveBps: Number(minimumMoveBps.toFixed(4)),
    minimumMoveNeeded: Number(minimumMoveNeeded.toFixed(8)),
    netTargetFeasible,
    projectedFreeMargin: Number(projectedFreeMargin.toFixed(6)),
    projectedMarginLevel: Number(projectedMarginLevel.toFixed(2)),
    reason: blockingReasons.length
      ? `CFD Skill bloquea: ${blockingReasons.join(' ')}`
      : `CFD Skill aprueba: target neto $${input.targetNetUsd} factible; movimiento minimo ${minimumMoveBps.toFixed(2)} bps; costos y margen post-entrada dentro de rango.`,
    recommendations,
  }
}
