import { evaluateCfdOpportunity } from '../cfd/cfdExpertAgent.js'
import type { CfdQuote } from '../cfd/cfdPricingEngine.js'
import { assert, done } from './assert.js'

const quote: CfdQuote = {
  cfdSymbol: 'ETHUSD.cfd',
  underlyingSymbol: 'ETHUSDT',
  bid: 3000,
  ask: 3003,
  mid: 3001.5,
  spread: 3,
  spreadBps: 10,
  provider: 'Binance',
  feedType: 'REALTIME_TICK',
  pricingQuality: 'LIVE_MID_ESTIMATED_SPREAD',
  lastPriceUpdate: new Date().toISOString(),
  sourcePrice: {
    asset: 'ETHUSD.cfd',
    mappedSymbol: 'ETHUSDT',
    price: 3001.5,
    previousPrice: 3000,
    change: 1.5,
    changePercent: 0.05,
    provider: 'Binance',
    feedType: 'REALTIME_TICK',
    lastPriceUpdate: new Date().toISOString(),
    isDynamicPriceAvailable: true,
    validForPaperPositionTracking: true,
    validForScalping: false,
    message: 'test',
  },
}

const approved = evaluateCfdOpportunity({
  quote,
  assetClass: 'CRYPTO_CFD',
  equity: 2500,
  usedMargin: 0,
  expectedProfit: 3,
  positionSize: 0.01,
  notionalExposure: 30.015,
  riskPercent: 0.15,
  riskReward: 2.1,
  setupConfirmed: true,
  tradeQualityScore: 90,
  leverage: 1,
})
assert(approved.approved, approved.reason)
assert(approved.recommendedLeverage === 1, 'Default leverage must be 1x.')

const blocked = evaluateCfdOpportunity({
  ...approved,
  quote: { ...quote, feedType: 'ERROR', pricingQuality: 'ERROR' },
  assetClass: 'CRYPTO_CFD',
  equity: 2500,
  usedMargin: 0,
  expectedProfit: 3,
  positionSize: 0.01,
  notionalExposure: 30.015,
  riskPercent: 0.15,
  riskReward: 2.1,
  setupConfirmed: true,
  tradeQualityScore: 90,
  leverage: 1,
})
assert(!blocked.approved, 'CFD Expert must block invalid pricing.')
done('cfd-expert')
