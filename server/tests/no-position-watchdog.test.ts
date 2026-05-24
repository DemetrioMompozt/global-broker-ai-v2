import { buildNoPositionWatchdog } from '../ops/noPositionWatchdog.js'
import { assert, done } from './assert.js'

const account = { balance: 2500, closedPnl: 0, equity: 2500, freeMargin: 2400, marginLevel: 900, openPnl: 0, portfolioLeverage: 0, usedMargin: 100 }
const quote = {
  ask: 1.10002,
  bid: 1.1,
  brokerTime: null,
  cfdSymbol: 'EURUSD.cfd',
  feedType: 'BROKER_DEMO_REALTIME',
  lastPriceUpdate: new Date().toISOString(),
  mid: 1.10001,
  previousPrice: 1.1,
  provider: 'VT Markets MT5 Demo',
  pricingQuality: 'LIVE_BID_ASK',
  sourcePrice: { feedType: 'BROKER_DEMO_REALTIME' },
  spread: 0.00002,
  spreadBps: 0.18,
  underlyingSymbol: 'EURUSD',
}
const opportunity = {
  assetClass: 'FOREX_CFD',
  cfdExpertScore: 76,
  cfdSymbol: 'EURUSD.cfd',
  decision: 'WATCH',
  direction: 'LONG',
  expectedNetProfit: 2.25,
  opportunityScore: 80,
  quote,
  reason: 'test',
  riskReward: 2.1,
  setupConfirmed: false,
  setupStatus: 'SETUP_FORMING',
  source: 'VT_MARKETS_MT5_DEMO',
  strategy: 'SessionMomentum',
  timeframe: 'INTRADAY_SLOW',
  underlyingSymbol: 'EURUSD',
}

const triggered = buildNoPositionWatchdog({
  account,
  auditGrade: 'PROFESSIONAL_READY',
  lastPositionOpenedAt: new Date(Date.now() - 130_000).toISOString(),
  openPositions: [],
  opportunities: [opportunity as never],
})
assert(triggered.active, 'Watchdog must trigger after 2 minutes without new positions.')
assert(triggered.action === 'OPEN_CONTROLLED_PROBE', 'Watchdog should request controlled probe.')

const blocked = buildNoPositionWatchdog({
  account,
  auditGrade: 'BLOCKED',
  lastPositionOpenedAt: new Date(Date.now() - 130_000).toISOString(),
  openPositions: [],
  opportunities: [opportunity as never],
})
assert(!blocked.active && blocked.action === 'WAIT_FOR_AUDIT', 'Audit block must prevent watchdog entries.')

done('no-position-watchdog')
