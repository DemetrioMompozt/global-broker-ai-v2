import { validateTraderEntryGate } from '../cfd/cfdTraderEntryGate.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'
import type { CfdQuote } from '../cfd/cfdPricingEngine.js'
import { assert, done } from './assert.js'

const quote: CfdQuote = {
  ask: 1.10002,
  bid: 1.10001,
  cfdSymbol: 'EURUSD.cfd',
  feedType: 'BROKER_DEMO_REALTIME',
  lastPriceUpdate: new Date().toISOString(),
  mid: 1.100015,
  pricingQuality: 'LIVE_BID_ASK',
  provider: 'VT Markets MT5 Demo',
  sourcePrice: {
    asset: 'EURUSD.cfd',
    change: 0.0002,
    changePercent: 0.02,
    feedType: 'BROKER_DEMO_REALTIME',
    isDynamicPriceAvailable: true,
    lastPriceUpdate: new Date().toISOString(),
    mappedSymbol: 'EURUSD',
    message: 'test',
    previousPrice: 1.0998,
    price: 1.100015,
    provider: 'VT Markets MT5 Demo',
    validForPaperPositionTracking: true,
    validForScalping: false,
  },
  spread: 0.00001,
  spreadBps: 0.09,
  underlyingSymbol: 'EURUSD',
}

const baseOpportunity: Opportunity = {
  assetClass: 'FOREX_CFD',
  cfdExpertScore: 90,
  cfdSymbol: 'EURUSD.cfd',
  decision: 'APPROVED',
  direction: 'LONG',
  edgeEfficiency: 0.5,
  edgeMoveBps: 1.2,
  edgePersistence: 0.7,
  edgeRequiredMoveBps: 0.5,
  expectedNetProfit: 3.6,
  opportunityScore: 92,
  quote,
  reason: 'test',
  riskReward: 2.1,
  setupConfirmed: true,
  setupStatus: 'CONFIRMED',
  source: 'VT_MARKETS_MT5_DEMO',
  strategy: 'SessionMomentum',
  timeframe: 'INTRADAY_SLOW',
  underlyingSymbol: 'EURUSD',
}

const account = { balance: 2500, equity: 2500, freeMargin: 1800, marginLevel: 260, openPnl: 0, portfolioLeverage: 0, usedMargin: 700 }
const weakEffectiveness = { closedToday: 8, expectedPayoff: -0.5, netProfitToday: -4, status: 'MEASURING' as const }

const approved = validateTraderEntryGate({ account, effectiveness: weakEffectiveness, openPositions: [], opportunity: baseOpportunity })
assert(approved.approved, approved.reason)

const weak = validateTraderEntryGate({
  account,
  effectiveness: weakEffectiveness,
  openPositions: [],
  opportunity: { ...baseOpportunity, cfdExpertScore: 82, edgeEfficiency: 0.2, expectedNetProfit: 2.4, opportunityScore: 86 },
})
assert(!weak.approved && weak.reason.includes('skill repair'), 'Weak recent performance must require sniper-quality entries.')

const marginLocked = validateTraderEntryGate({
  account: { ...account, freeMargin: 200, marginLevel: 130 },
  effectiveness: weakEffectiveness,
  openPositions: [
    { assetClass: 'FOREX_CFD', cfdExpertReason: 'x', cfdExpertScore: 90, cfdSymbol: 'GBPUSD.cfd', currentPrice: 1, direction: 'LONG', entryPrice: 1, feedType: 'BROKER_DEMO_REALTIME', id: '1', lastPriceUpdate: new Date().toISOString(), leverage: 25, managementStatus: 'MANAGING_POSITION', marginRequired: 300, nextAction: 'HOLD', openPnl: 0, openPnlPercent: 0, openedAt: new Date().toISOString(), positionSize: 1, previousPrice: 1, provider: 'VT Markets MT5 Demo', riskPercent: 0.4, riskUsd: 10, source: 'VT_MARKETS_MT5_DEMO', spreadAtEntry: 0.01, stopLoss: 0.9, strategy: 'test', takeProfit: 1.1, thesis: 'x', underlyingSymbol: 'GBPUSD' },
    { assetClass: 'METAL_CFD', cfdExpertReason: 'x', cfdExpertScore: 90, cfdSymbol: 'XAUUSD.cfd', currentPrice: 1, direction: 'LONG', entryPrice: 1, feedType: 'BROKER_DEMO_REALTIME', id: '2', lastPriceUpdate: new Date().toISOString(), leverage: 25, managementStatus: 'MANAGING_POSITION', marginRequired: 300, nextAction: 'HOLD', openPnl: 0, openPnlPercent: 0, openedAt: new Date().toISOString(), positionSize: 1, previousPrice: 1, provider: 'VT Markets MT5 Demo', riskPercent: 0.4, riskUsd: 10, source: 'VT_MARKETS_MT5_DEMO', spreadAtEntry: 0.01, stopLoss: 0.9, strategy: 'test', takeProfit: 1.1, thesis: 'x', underlyingSymbol: 'XAUUSD' },
    { assetClass: 'INDEX_CFD', cfdExpertReason: 'x', cfdExpertScore: 90, cfdSymbol: 'NAS100.cfd', currentPrice: 1, direction: 'LONG', entryPrice: 1, feedType: 'BROKER_DEMO_REALTIME', id: '3', lastPriceUpdate: new Date().toISOString(), leverage: 25, managementStatus: 'MANAGING_POSITION', marginRequired: 300, nextAction: 'HOLD', openPnl: 0, openPnlPercent: 0, openedAt: new Date().toISOString(), positionSize: 1, previousPrice: 1, provider: 'VT Markets MT5 Demo', riskPercent: 0.4, riskUsd: 10, source: 'VT_MARKETS_MT5_DEMO', spreadAtEntry: 0.01, stopLoss: 0.9, strategy: 'test', takeProfit: 1.1, thesis: 'x', underlyingSymbol: 'NAS100' },
  ],
  opportunity: baseOpportunity,
})
assert(!marginLocked.approved && marginLocked.reason.includes('margin watch'), 'Margin watch must block growth when several positions are already open.')

done('trader-entry-gate')
