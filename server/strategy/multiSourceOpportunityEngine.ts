import { getCfdQuote } from '../cfd/cfdPricingEngine.js'
import { getTradableInstruments } from '../symbols/cfdInstrumentRegistry.js'
import { routeStrategy } from './opportunityStrategyRouter.js'
import { confirmCryptoSetup } from './setupConfirmationEngine.js'
import { scanVtMarketsOpportunities } from './vtMarketsOpportunityScanner.js'
import { scoreOpportunityWithLearning } from '../performance/adaptiveLearningEngine.js'
import { evaluateCandleBehavior } from './candleBehaviorEngine.js'
import type { Opportunity } from './globalOpportunityScanner.js'

async function scanBinanceCryptoOpportunities() {
  const opportunities: Opportunity[] = []
  const blocked: Array<{ cfdSymbol: string; reason: string }> = []
  for (const instrument of getTradableInstruments().filter((item) => item.assetClass === 'CRYPTO_CFD')) {
    const quote = await getCfdQuote(instrument.cfdSymbol)
    if (quote.feedType !== 'REALTIME_TICK' && quote.feedType !== 'DELAYED_INTRADAY') {
      blocked.push({ cfdSymbol: instrument.cfdSymbol, reason: 'BLOCKED_BY_DATA: Binance realtime no disponible para cripto CFD.' })
      continue
    }
    const setup = confirmCryptoSetup(instrument.underlyingSymbol)
    const momentumScore = Math.min(95, Math.max(60, 80 + quote.sourcePrice.changePercent * 10))
    const direction = setup.direction ?? (quote.sourcePrice.change < 0 ? 'SHORT' : 'LONG')
    const candle = evaluateCandleBehavior(instrument.underlyingSymbol, 'BINANCE_REALTIME', direction)
    const candleBlocks = candle.signal === 'BLOCKS_ENTRY'
    const candleBoost = candle.signal === 'CONFIRMS_ENTRY' ? 5 : candleBlocks ? -12 : 0
    opportunities.push({
      assetClass: instrument.assetClass,
      cfdExpertScore: setup.isConfirmed ? 87 : 78,
      cfdSymbol: instrument.cfdSymbol,
      decision: setup.isConfirmed ? 'APPROVED' : 'WATCH',
      direction,
      expectedNetProfit: Number((1.6 + momentumScore / 80).toFixed(2)),
      candleBehavior: candle,
      candleBehaviorScore: candle.score,
      candlePattern: candle.pattern,
      opportunityScore: setup.isConfirmed ? Math.max(86, momentumScore + candleBoost) : momentumScore + candleBoost,
      quote,
      reason: `${setup.reason} ${candle.reason}`,
      riskReward: 2.1,
      setupConfirmed: setup.isConfirmed && !candleBlocks,
      setupStatus: candleBlocks ? 'CANDLE_BLOCKED' : setup.setupStatus,
      source: 'BINANCE_REALTIME',
      strategy: routeStrategy(instrument.assetClass, momentumScore),
      timeframe: 'INTRADAY_SLOW',
      underlyingSymbol: instrument.underlyingSymbol,
    })
  }
  return { blocked, opportunities }
}

export async function scanMultiSourceOpportunities() {
  const [vt, crypto] = await Promise.all([
    scanVtMarketsOpportunities(),
    scanBinanceCryptoOpportunities(),
  ])
  const opportunities = [...vt.opportunities, ...crypto.opportunities].map((opportunity) => {
    const learning = scoreOpportunityWithLearning(opportunity)
    return {
      ...opportunity,
      learningAdjustedScore: learning.adjustedScore,
      learningBias: learning.boost + learning.penalty,
      learningReason: learning.reason,
    }
  }).sort((a, b) => {
    const learned = (b.learningAdjustedScore ?? b.opportunityScore) - (a.learningAdjustedScore ?? a.opportunityScore)
    if (learned !== 0) return learned
    const expert = (b.cfdExpertScore ?? 0) - (a.cfdExpertScore ?? 0)
    if (expert !== 0) return expert
    const setup = b.opportunityScore - a.opportunityScore
    if (setup !== 0) return setup
    const rr = (b.riskReward ?? 0) - (a.riskReward ?? 0)
    if (rr !== 0) return rr
    return (b.expectedNetProfit ?? 0) - (a.expectedNetProfit ?? 0)
  })
  return {
    blocked: [...vt.blocked, ...crypto.blocked],
    lastScanAt: new Date().toISOString(),
    opportunities,
    scannerStatus: opportunities.length ? 'SCANNING' as const : 'WAITING_FOR_DATA' as const,
  }
}
