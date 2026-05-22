import { getCfdQuote } from '../cfd/cfdPricingEngine.js'
import { getTradableInstruments } from '../symbols/cfdInstrumentRegistry.js'
import { routeStrategy } from './opportunityStrategyRouter.js'
import { confirmCryptoSetup } from './setupConfirmationEngine.js'
import { scanMultiSourceOpportunities } from './multiSourceOpportunityEngine.js'

export type Opportunity = {
  cfdSymbol: string
  underlyingSymbol: string
  assetClass: string
  opportunityScore: number
  strategy: string
  timeframe: 'INTRADAY_SLOW' | 'SHORT_SWING' | 'SWING_TRADING'
  setupStatus: string
  setupConfirmed: boolean
  reason: string
  source?: 'BINANCE_REALTIME' | 'VT_MARKETS_MT5_DEMO'
  decision?: 'APPROVED' | 'WATCH' | 'BLOCKED'
  direction?: 'LONG' | 'SHORT'
  cfdExpertScore?: number
  riskReward?: number
  expectedNetProfit?: number
  candleBehavior?: unknown
  candleBehaviorScore?: number
  candlePattern?: string
  learningAdjustedScore?: number
  learningBias?: number
  learningReason?: string
  edgeEfficiency?: number
  edgeMoveBps?: number
  edgePersistence?: number
  edgeRequiredMoveBps?: number
  quote: Awaited<ReturnType<typeof getCfdQuote>>
}

export async function scanGlobalOpportunities() {
  return scanMultiSourceOpportunities()
}

export async function scanCryptoOnlyOpportunities() {
  const opportunities: Opportunity[] = []
  const blocked: Array<{ cfdSymbol: string; reason: string }> = []
  for (const instrument of getTradableInstruments()) {
    const quote = await getCfdQuote(instrument.cfdSymbol)
    if (quote.sourcePrice.feedType === 'ERROR' || quote.sourcePrice.feedType === 'MOCK_DATA') {
      blocked.push({ cfdSymbol: instrument.cfdSymbol, reason: 'Feed no valido.' })
      continue
    }
    if (instrument.assetClass !== 'CRYPTO_CFD') {
      blocked.push({ cfdSymbol: instrument.cfdSymbol, reason: 'Preparado para VT Markets demo; sin feed broker configurado.' })
      continue
    }
    const setup = confirmCryptoSetup(instrument.underlyingSymbol)
    const momentumScore = Math.min(95, Math.max(60, 80 + quote.sourcePrice.changePercent * 10))
    opportunities.push({
      cfdSymbol: instrument.cfdSymbol,
      underlyingSymbol: instrument.underlyingSymbol,
      assetClass: instrument.assetClass,
      opportunityScore: setup.isConfirmed ? Math.max(86, momentumScore) : momentumScore,
      strategy: routeStrategy(instrument.assetClass, momentumScore),
      timeframe: 'INTRADAY_SLOW',
      setupStatus: setup.setupStatus,
      setupConfirmed: setup.isConfirmed,
      reason: setup.reason,
      quote,
    })
  }
  opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore)
  return {
    scannerStatus: opportunities.length ? 'SCANNING' as const : 'WAITING_FOR_DATA' as const,
    opportunities,
    blocked,
    lastScanAt: new Date().toISOString(),
  }
}
