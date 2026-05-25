import { buildCfdTraderSkillReadout } from '../cfd/cfdTraderSkillEngine.js'
import type { CfdPosition } from '../storage/tradeStore.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'
import type { CfdQuote } from '../cfd/cfdPricingEngine.js'
import { assert, done } from './assert.js'

const quote: CfdQuote = {
  cfdSymbol: 'GBPUSD.cfd',
  underlyingSymbol: 'GBPUSD',
  bid: 1.25,
  ask: 1.25001,
  mid: 1.250005,
  spread: 0.00001,
  spreadBps: 0.08,
  provider: 'VT Markets MT5 Demo',
  feedType: 'BROKER_DEMO_REALTIME',
  pricingQuality: 'LIVE_BID_ASK',
  lastPriceUpdate: new Date().toISOString(),
  sourcePrice: {
    asset: 'GBPUSD.cfd',
    mappedSymbol: 'GBPUSD',
    price: 1.25,
    previousPrice: 1.249,
    change: 0.001,
    changePercent: 0.08,
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
  cfdExpertScore: 90,
  cfdSymbol: 'GBPUSD.cfd',
  decision: 'APPROVED',
  direction: 'LONG',
  expectedNetProfit: 3.5,
  opportunityScore: 92,
  quote,
  reason: 'spread bajo y setup confirmado',
  riskReward: 2.1,
  setupConfirmed: true,
  setupStatus: 'CONFIRMED',
  source: 'VT_MARKETS_MT5_DEMO',
  strategy: 'SessionMomentum',
  timeframe: 'INTRADAY_SLOW',
  underlyingSymbol: 'GBPUSD',
}

const weakPosition: CfdPosition = {
  assetClass: 'INDEX_CFD',
  cfdExpertReason: 'test',
  cfdExpertScore: 70,
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
  minimumMoveBps: 150,
  nextAction: 'HOLD',
  openPnl: -1.2,
  openPnlPercent: -0.03,
  openedAt: new Date(Date.now() - 2_100_000).toISOString(),
  positionSize: 1,
  previousPrice: 100,
  provider: 'VT Markets MT5 Demo',
  riskPercent: 0.1,
  riskUsd: 2,
  source: 'VT_MARKETS_MT5_DEMO',
  spreadAtEntry: 0.5,
  stopLoss: 90,
  strategy: 'PullbackContinuation',
  takeProfit: 120,
  thesis: 'test',
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
    closedToday: 0,
    expectedPayoff: 0,
    minFreeMargin: 1700,
    minMarginLevel: 300,
    netProfitToday: 0,
    openPnl: -1.2,
    openPositions: 1,
    opportunitiesBlocked: 0,
    partialProfitClosuresToday: 0,
    partialProfitPnlToday: 0,
    principalBlockingReason: null,
    principalClosureReason: null,
    profitFactor: 0,
    profitFactorDisplay: 'muestra insuficiente',
    reason: 'midiendo',
    rotationsToday: 0,
    score: 20,
    staleClosuresToday: 0,
    stalePositions: 1,
    status: 'MEASURING',
    targetHitsToday: 0,
    winRate: 0,
  },
  opportunities: [opportunity],
  positions: [weakPosition],
})

assert(readout.mode === 'ROTATING', `Expected ROTATING, got ${readout.mode}`)
assert(readout.strongestOpportunity?.cfdSymbol === 'GBPUSD.cfd', 'Should identify strongest fresh opportunity.')
assert(readout.weakestPosition?.cfdSymbol === 'NAS100.cfd', 'Should identify weakest position.')
assert(readout.surpriseMove.includes('Cerrar'), 'Should produce an actionable surprise move.')
assert(readout.suggestedActions.some((action) => action.type === 'CLOSE_STALE_NEGATIVE_POSITION'), 'Should suggest closing stale negative positions.')
assert(readout.executableActions.some((action) => action.type === 'CLOSE_STALE_NEGATIVE_POSITION'), 'Should produce executable stale close action.')
assert(readout.executableActions.some((action) => action.type === 'ROTATE_CAPITAL'), 'Should produce executable capital rotation action.')

done('cfd-trader-skill')
