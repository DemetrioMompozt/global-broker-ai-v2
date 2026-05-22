import { buildCfdTraderSkillReadout } from '../cfd/cfdTraderSkillEngine.js'
import type { CfdQuote } from '../cfd/cfdPricingEngine.js'
import type { CfdPosition } from '../storage/tradeStore.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'
import { assert, done } from './assert.js'

const quote: CfdQuote = {
  cfdSymbol: 'EURUSD.cfd',
  underlyingSymbol: 'EURUSD',
  bid: 1.1,
  ask: 1.10001,
  mid: 1.100005,
  spread: 0.00001,
  spreadBps: 0.09,
  provider: 'VT Markets MT5 Demo',
  feedType: 'BROKER_DEMO_REALTIME',
  pricingQuality: 'LIVE_BID_ASK',
  lastPriceUpdate: new Date().toISOString(),
  sourcePrice: {
    asset: 'EURUSD.cfd',
    mappedSymbol: 'EURUSD',
    price: 1.100005,
    previousPrice: 1.1,
    change: 0.000005,
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

const opportunity: Opportunity = {
  assetClass: 'FOREX_CFD',
  cfdExpertScore: 95,
  cfdSymbol: 'EURUSD.cfd',
  decision: 'APPROVED',
  direction: 'LONG',
  expectedNetProfit: 4,
  opportunityScore: 94,
  quote,
  reason: 'fresh superior setup',
  riskReward: 2.2,
  setupConfirmed: true,
  setupStatus: 'CONFIRMED',
  source: 'VT_MARKETS_MT5_DEMO',
  strategy: 'SessionMomentum',
  timeframe: 'INTRADAY_SLOW',
  underlyingSymbol: 'EURUSD',
}

const weak: CfdPosition = {
  assetClass: 'INDEX_CFD',
  cfdExpertReason: 'weak',
  cfdExpertScore: 55,
  cfdSymbol: 'NAS100.cfd',
  currentPrice: 100,
  direction: 'LONG',
  entryPrice: 101,
  feedType: 'BROKER_DEMO_REALTIME',
  id: 'weak',
  lastPriceUpdate: new Date().toISOString(),
  leverage: 2,
  managementStatus: 'MANAGING_POSITION',
  marginRequired: 200,
  minimumMoveBps: 190,
  nextAction: 'HOLD',
  openPnl: -1.2,
  openPnlPercent: -0.04,
  openedAt: new Date(Date.now() - 2_100_000).toISOString(),
  positionSize: 1,
  previousPrice: 100,
  provider: 'VT Markets MT5 Demo',
  riskPercent: 0.1,
  riskUsd: 2,
  source: 'VT_MARKETS_MT5_DEMO',
  spreadAtEntry: 0.4,
  stopLoss: 90,
  strategy: 'PullbackContinuation',
  takeProfit: 120,
  thesis: 'weak',
  underlyingSymbol: 'NAS100',
}

const readout = buildCfdTraderSkillReadout({
  account: { balance: 2500, equity: 2498.8, freeMargin: 1700, marginLevel: 300, openPnl: -1.2, portfolioLeverage: 0.4, usedMargin: 798.8 },
  effectiveness: {
    averageNetLoss: 0,
    averageNetWin: 0,
    averageTimeToTargetSeconds: null,
    closedByLossToday: 0,
    closedByRotationToday: 0,
    closedByStaleToday: 0,
    closedPnl: 0,
    closedToday: 12,
    expectedPayoff: 0.2,
    minFreeMargin: 1700,
    minMarginLevel: 300,
    netProfitToday: 2.4,
    openPnl: -1.2,
    openPositions: 1,
    opportunitiesBlocked: 0,
    principalBlockingReason: null,
    principalClosureReason: null,
    profitFactor: 1.4,
    profitFactorDisplay: '1.40',
    reason: 'effective',
    rotationsToday: 0,
    score: 80,
    staleClosuresToday: 0,
    stalePositions: 1,
    status: 'EFFECTIVE',
    targetHitsToday: 4,
    winRate: 70,
  },
  opportunities: [opportunity],
  positions: [weak],
})

assert(readout.confidence === 'HIGH', 'Effective sample should produce HIGH confidence.')
assert(readout.mode === 'ROTATING', 'Superior fresh opportunity plus stale weak position should ROTATE.')
assert(readout.executableActions.some((action) => action.type === 'ROTATE_CAPITAL'), 'ROTATING/HIGH should executable ROTATE_CAPITAL.')

done('capital-rotation')
