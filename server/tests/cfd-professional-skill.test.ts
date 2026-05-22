import type { AccountSnapshot } from '../risk/accountHealthGuard.js'
import type { CfdQuote } from '../cfd/cfdPricingEngine.js'
import { evaluateCfdProfessionalSkill } from '../cfd/cfdProfessionalSkillEngine.js'
import { assert, done } from './assert.js'

const account: AccountSnapshot = {
  balance: 2500,
  equity: 2500,
  freeMargin: 2100,
  marginLevel: 625,
  openPnl: 0,
  portfolioLeverage: 1,
  usedMargin: 400,
}

const quote: CfdQuote = {
  cfdSymbol: 'EURUSD.cfd',
  underlyingSymbol: 'EURUSD',
  bid: 1.10001,
  ask: 1.10002,
  mid: 1.100015,
  spread: 0.00001,
  spreadBps: 0.09,
  provider: 'VT Markets MT5 Demo',
  feedType: 'BROKER_DEMO_REALTIME',
  pricingQuality: 'LIVE_BID_ASK',
  lastPriceUpdate: new Date().toISOString(),
  sourcePrice: {
    asset: 'EURUSD.cfd',
    mappedSymbol: 'EURUSD',
    price: 1.100015,
    previousPrice: 1.1,
    change: 0.000015,
    changePercent: 0.001,
    provider: 'VT Markets MT5 Demo',
    feedType: 'BROKER_DEMO_REALTIME',
    lastPriceUpdate: new Date().toISOString(),
    isDynamicPriceAvailable: true,
    validForPaperPositionTracking: true,
    validForScalping: false,
    message: 'test',
  },
}

const baseCosts = {
  commission: 0,
  slippageEstimate: 0.18,
  spreadCost: 0.2,
  swapAccrued: 0,
  totalEstimatedCost: 0.38,
  costToProfitRatio: 0.19,
}

const approved = evaluateCfdProfessionalSkill({
  account,
  assetClass: 'FOREX_CFD',
  costs: baseCosts,
  expectedNetProfit: 2.2,
  marginRequired: 125,
  positionSize: 10000,
  quote,
  targetNetUsd: 2,
})
assert(approved.approved, approved.reason)
assert(approved.minimumGrossProfitNeeded === 2.38, 'Minimum gross profit should include target plus costs.')

const lowEdge = evaluateCfdProfessionalSkill({
  account,
  assetClass: 'FOREX_CFD',
  costs: baseCosts,
  expectedNetProfit: 1.99,
  marginRequired: 125,
  positionSize: 10000,
  quote,
  targetNetUsd: 2,
})
assert(!lowEdge.approved && lowEdge.reason.includes('Expected net profit'), 'Must block if expected net profit is below $2.')

const badSpread = evaluateCfdProfessionalSkill({
  account,
  assetClass: 'FOREX_CFD',
  costs: { ...baseCosts, spreadCost: 0.71, totalEstimatedCost: 0.9, costToProfitRatio: 0.45 },
  expectedNetProfit: 2.4,
  marginRequired: 125,
  positionSize: 10000,
  quote,
  targetNetUsd: 2,
})
assert(!badSpread.approved && badSpread.reason.includes('Spread'), 'Must block spread above 20% of target.')

const badCosts = evaluateCfdProfessionalSkill({
  account,
  assetClass: 'FOREX_CFD',
  costs: { ...baseCosts, spreadCost: 0.2, totalEstimatedCost: 1.11, costToProfitRatio: 0.555 },
  expectedNetProfit: 2.4,
  marginRequired: 125,
  positionSize: 10000,
  quote,
  targetNetUsd: 2,
})
assert(!badCosts.approved && badCosts.reason.includes('Costos'), 'Must block costs above 30% of target.')

const badMargin = evaluateCfdProfessionalSkill({
  account: { ...account, equity: 2500, freeMargin: 100, marginLevel: 170, usedMargin: 2400 },
  assetClass: 'FOREX_CFD',
  costs: baseCosts,
  expectedNetProfit: 2.4,
  marginRequired: 125,
  positionSize: 10000,
  quote,
  targetNetUsd: 2,
})
assert(!badMargin.approved && badMargin.reason.includes('Margen post-entrada'), 'Must block unhealthy post-entry margin.')

done('cfd-professional-skill')
