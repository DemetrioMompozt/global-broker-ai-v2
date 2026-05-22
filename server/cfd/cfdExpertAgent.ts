import { estimateCfdCosts } from './cfdCostModel.js'
import { calculateMargin } from './cfdMarginEngine.js'
import type { CfdQuote } from './cfdPricingEngine.js'
import { assessCfdSession } from './cfdSessionManager.js'
import type { AssetClass } from '../symbols/cfdInstrumentRegistry.js'

export type CfdExpertEvaluation = {
  approved: boolean
  decision: 'APPROVE' | 'BLOCK' | 'WATCH' | 'REDUCE_SIZE' | 'WAIT_FOR_BETTER_SPREAD' | 'WAIT_FOR_MARKET_SESSION'
  cfdSymbol: string
  underlyingSymbol: string
  assetClass: AssetClass
  expertScore: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'
  pricingQuality: 'LIVE_BID_ASK' | 'LIVE_MID_ESTIMATED_SPREAD' | 'DELAYED' | 'FALLBACK' | 'ERROR'
  spreadAssessment: 'GOOD' | 'ACCEPTABLE' | 'EXPENSIVE' | 'UNTRADABLE'
  marginAssessment: 'HEALTHY' | 'WATCH' | 'DANGEROUS'
  leverageAssessment: 'SAFE' | 'MODERATE' | 'HIGH' | 'EXCESSIVE'
  sessionAssessment: 'OPEN' | 'THIN_LIQUIDITY' | 'CLOSED' | '24_7'
  recommendedLeverage: number
  maxAllowedLeverage: number
  leverageReason: string
  cost: ReturnType<typeof estimateCfdCosts>
  reason: string
  blockingReasons: string[]
  recommendations: string[]
}

let lastEvaluation: CfdExpertEvaluation | null = null

export function getLastCfdExpertEvaluation() {
  return lastEvaluation
}

export function evaluateCfdOpportunity(input: {
  quote: CfdQuote
  assetClass: AssetClass
  equity: number
  usedMargin: number
  expectedProfit: number
  positionSize: number
  notionalExposure: number
  riskPercent: number
  riskReward: number
  setupConfirmed: boolean
  tradeQualityScore: number
  leverage: number
}) {
  const blockingReasons: string[] = []
  const recommendations: string[] = []
  const maxAllowedLeverage = input.assetClass === 'CRYPTO_CFD' || input.assetClass === 'EQUITY_CFD' ? 1 : 25
  const session = assessCfdSession(input.assetClass)
  const cost = estimateCfdCosts({ expectedProfit: input.expectedProfit, positionSize: input.positionSize, spread: input.quote.spread, overnight: false })
  const margin = calculateMargin({ equity: input.equity, usedMargin: input.usedMargin, notionalExposure: input.notionalExposure, leverage: input.leverage })
  const spreadAssessment = input.quote.spreadBps > 80 ? 'UNTRADABLE' : input.quote.spreadBps > 35 ? 'EXPENSIVE' : input.quote.spreadBps > 12 ? 'ACCEPTABLE' : 'GOOD'
  const leverageAssessment = input.leverage > maxAllowedLeverage ? 'EXCESSIVE' : input.leverage > 12 ? 'HIGH' : input.leverage > 1 ? 'MODERATE' : 'SAFE'
  const pricingQuality = input.quote.pricingQuality === 'ERROR'
    ? 'ERROR'
    : input.quote.feedType === 'REALTIME_TICK' || input.quote.feedType === 'BROKER_DEMO_REALTIME'
      ? input.quote.pricingQuality
      : 'FALLBACK'

  if (pricingQuality === 'ERROR' || pricingQuality === 'FALLBACK') blockingReasons.push('Pricing no apto para nueva entrada CFD paper.')
  if (spreadAssessment === 'UNTRADABLE') blockingReasons.push('Spread no operable.')
  if (cost.costToProfitRatio > 0.45) blockingReasons.push('Costos consumen mas del 45% del beneficio esperado en modo demo agresivo.')
  if (margin.marginAssessment === 'DANGEROUS') blockingReasons.push('Margin level post-trade peligroso.')
  if (leverageAssessment === 'EXCESSIVE') blockingReasons.push('Apalancamiento excede limite conservador.')
  if (!session.marketOpen) blockingReasons.push('Sesion no valida.')
  if (!input.setupConfirmed) blockingReasons.push('Setup no confirmado con velas cerradas.')
  if (input.riskReward < 2) blockingReasons.push('R/R menor a 2.0.')
  if (input.expectedProfit <= 0) blockingReasons.push('Expected net profit no positivo.')
  if (input.assetClass === 'CRYPTO_CFD' && input.quote.feedType !== 'REALTIME_TICK') blockingReasons.push('Crypto CFD exige Binance REALTIME_TICK.')

  const setupScore = input.setupConfirmed ? 25 : 10
  const pricingScore = pricingQuality === 'LIVE_MID_ESTIMATED_SPREAD' || pricingQuality === 'LIVE_BID_ASK' ? 20 : 0
  const costScore = cost.costToProfitRatio <= 0.05 ? 15 : cost.costToProfitRatio <= 0.2 ? 8 : 0
  const marginScore = margin.marginAssessment === 'HEALTHY' ? 15 : margin.marginAssessment === 'WATCH' ? 8 : 0
  const volatilityScore = input.riskPercent <= 0.5 ? 10 : 4
  const sessionScore = session.marketOpen ? 10 : 0
  const portfolioScore = 5
  const expertScore = Math.round(setupScore + pricingScore + costScore + marginScore + volatilityScore + sessionScore + portfolioScore)
  const minScore = input.assetClass === 'CRYPTO_CFD' ? 85 : 80
  if (expertScore < minScore) blockingReasons.push(`CFD Expert Score ${expertScore} menor a ${minScore}.`)

  const approved = blockingReasons.length === 0
  if (!approved && spreadAssessment === 'EXPENSIVE') recommendations.push('Esperar mejor spread antes de operar.')
  recommendations.push('Mantener paper only; no hay ejecucion ni apalancamiento real.')

  const evaluation: CfdExpertEvaluation = {
    approved,
    decision: approved ? 'APPROVE' : spreadAssessment === 'EXPENSIVE' ? 'WAIT_FOR_BETTER_SPREAD' : 'BLOCK',
    cfdSymbol: input.quote.cfdSymbol,
    underlyingSymbol: input.quote.underlyingSymbol,
    assetClass: input.assetClass,
    expertScore,
    riskLevel: expertScore >= 90 ? 'LOW' : expertScore >= 80 ? 'MEDIUM' : expertScore >= 65 ? 'HIGH' : 'EXTREME',
    pricingQuality,
    spreadAssessment,
    marginAssessment: margin.marginAssessment,
    leverageAssessment,
    sessionAssessment: session.sessionAssessment === '24_7' ? '24_7' : session.marketOpen ? 'OPEN' : 'CLOSED',
    recommendedLeverage: input.assetClass === 'CRYPTO_CFD' || input.assetClass === 'EQUITY_CFD' ? 1 : Math.min(25, maxAllowedLeverage),
    maxAllowedLeverage,
    leverageReason: input.assetClass === 'CRYPTO_CFD' || input.assetClass === 'EQUITY_CFD'
      ? 'Cripto/equity CFD se mantiene en 1x paper; no se usa apalancamiento real.'
      : 'Modo demo agresivo: hasta 25x paper en CFDs no cripto, sin ordenes reales ni ejecucion broker.',
    cost,
    reason: approved
      ? `Operacion aprobada: ${input.quote.cfdSymbol} tiene feed ${input.quote.feedType}, spread ${spreadAssessment}, margen ${margin.marginAssessment}, R/R ${input.riskReward.toFixed(2)} y riesgo ${input.riskPercent.toFixed(2)}%.`
      : `Operacion bloqueada: ${blockingReasons.join(' ')}`,
    blockingReasons,
    recommendations,
  }
  lastEvaluation = evaluation
  return evaluation
}
