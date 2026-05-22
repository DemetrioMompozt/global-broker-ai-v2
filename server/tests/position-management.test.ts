import { buildCfdTraderSkillReadout } from '../cfd/cfdTraderSkillEngine.js'
import type { CfdPosition } from '../storage/tradeStore.js'
import { assert, done } from './assert.js'

const stalePosition: CfdPosition = {
  assetClass: 'METAL_CFD',
  cfdExpertReason: 'test',
  cfdExpertScore: 65,
  cfdSymbol: 'XAUUSD.cfd',
  currentPrice: 2000,
  direction: 'LONG',
  entryPrice: 2001,
  feedType: 'BROKER_DEMO_REALTIME',
  id: 'stale',
  lastPriceUpdate: new Date().toISOString(),
  leverage: 2,
  managementStatus: 'MANAGING_POSITION',
  marginRequired: 200,
  nextAction: 'HOLD',
  openPnl: -1.2,
  openPnlPercent: -0.03,
  openedAt: new Date(Date.now() - 2_100_000).toISOString(),
  positionSize: 1,
  previousPrice: 2000,
  provider: 'VT Markets MT5 Demo',
  riskPercent: 0.1,
  riskUsd: 2,
  source: 'VT_MARKETS_MT5_DEMO',
  spreadAtEntry: 0.2,
  stopLoss: 1980,
  strategy: 'BreakoutConfirmed',
  takeProfit: 2040,
  thesis: 'test',
  underlyingSymbol: 'XAUUSD',
}

const readout = buildCfdTraderSkillReadout({
  account: { balance: 2500, equity: 2498.8, freeMargin: 1700, marginLevel: 300, openPnl: -1.2, portfolioLeverage: 0.3, usedMargin: 798.8 },
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
  opportunities: [],
  positions: [stalePosition],
})

assert(readout.mode === 'MANAGING', 'Without fresh replacement, stale review remains MANAGING.')
assert(readout.executableActions.some((action) => action.type === 'CLOSE_STALE_NEGATIVE_POSITION'), 'MANAGING should create executable close action for stale negative position.')
assert(readout.executableActions.some((action) => action.type === 'WATCH_RISK_POSITION'), 'MANAGING should watch the weakest risk position.')

done('position-management')
