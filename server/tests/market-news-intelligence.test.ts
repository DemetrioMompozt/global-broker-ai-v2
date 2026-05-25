import { validateMarketNewsForOpportunity } from '../intelligence/marketNewsIntelligence.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'
import { assert, done } from './assert.js'

const opportunity: Opportunity = {
  assetClass: 'FOREX_CFD',
  candleBehavior: { score: 74, signal: 'CONFIRMS_ENTRY' },
  cfdExpertScore: 90,
  cfdSymbol: 'EURUSD.cfd',
  direction: 'LONG',
  expectedNetProfit: 3,
  opportunityScore: 92,
  quote: {
    ask: 1.1,
    bid: 1.09999,
    cfdSymbol: 'EURUSD.cfd',
    feedType: 'BROKER_DEMO_REALTIME',
    lastPriceUpdate: new Date().toISOString(),
    mid: 1.099995,
    pricingQuality: 'LIVE_BID_ASK',
    provider: 'VT Markets MT5 Demo',
    sourcePrice: {
      asset: 'EURUSD.cfd',
      change: 0,
      changePercent: 0,
      feedType: 'BROKER_DEMO_REALTIME',
      isDynamicPriceAvailable: true,
      lastPriceUpdate: new Date().toISOString(),
      mappedSymbol: 'EURUSD',
      message: 'test',
      previousPrice: 1.1,
      price: 1.1,
      provider: 'VT Markets MT5 Demo',
      validForPaperPositionTracking: true,
      validForScalping: false,
    },
    spread: 0.00001,
    spreadBps: 0.09,
    underlyingSymbol: 'EURUSD',
  },
  reason: 'test',
  riskReward: 2.1,
  setupConfirmed: true,
  setupStatus: 'CONFIRMED',
  source: 'VT_MARKETS_MT5_DEMO',
  strategy: 'SessionMomentum',
  timeframe: 'INTRADAY_SLOW',
  underlyingSymbol: 'EURUSD',
}

const highImpactNews: Parameters<typeof validateMarketNewsForOpportunity>[0]['intelligence'] = {
  enabled: true,
  globalRisk: 'HIGH',
  lastUpdatedAt: new Date().toISOString(),
  nextUpdateAt: new Date(Date.now() + 300_000).toISOString(),
  sources: [{ name: 'test', status: 'OK', url: 'test' }],
  status: 'READY',
  summary: 'test',
  topEvents: [{
    affectedMarkets: ['USD', 'FOREX_CFD'],
    impact: 'HIGH',
    publishedAt: new Date().toISOString(),
    reason: 'macro USD/Fed',
    source: 'test',
    title: 'Federal Reserve rate decision moves dollar',
    url: 'https://example.com',
  }],
}

const blocked = validateMarketNewsForOpportunity({ intelligence: highImpactNews, opportunity })
assert(!blocked.approved, 'High-impact macro news must require extra confirmation before main paper.')

const elite = validateMarketNewsForOpportunity({
  intelligence: highImpactNews,
  opportunity: { ...opportunity, candleBehavior: { score: 88, signal: 'CONFIRMS_ENTRY' }, cfdExpertScore: 97, opportunityScore: 99 },
})
assert(elite.approved, elite.reason)

done('market-news-intelligence')
