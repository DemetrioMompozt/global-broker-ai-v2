import assert from 'node:assert'
import { buildProfitCadenceWatchdog } from '../ops/profitCadenceWatchdog.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'

const now = Date.now()
const account = { balance: 2500, equity: 2500, freeMargin: 1800, marginLevel: 300, openPnl: 0, portfolioLeverage: 0, usedMargin: 700 }
const opportunity: Opportunity = {
  assetClass: 'FOREX_CFD',
  candleBehavior: { score: 78, signal: 'NEUTRAL' },
  cfdExpertScore: 72,
  cfdSymbol: 'EURUSD.cfd',
  decision: 'WATCH',
  direction: 'LONG',
  expectedNetProfit: 2.2,
  opportunityScore: 76,
  quote: {
    ask: 1.1002,
    bid: 1.1001,
    cfdSymbol: 'EURUSD.cfd',
    feedType: 'BROKER_DEMO_REALTIME',
    lastPriceUpdate: new Date(now).toISOString(),
    mid: 1.10015,
    pricingQuality: 'LIVE_BID_ASK',
    provider: 'VT Markets MT5 Demo',
    sourcePrice: {
      asset: 'EURUSD',
      change: 0.0001,
      changePercent: 0.01,
      feedType: 'BROKER_DEMO_REALTIME',
      isDynamicPriceAvailable: true,
      lastPriceUpdate: new Date(now).toISOString(),
      mappedSymbol: 'EURUSD',
      message: 'live',
      previousPrice: 1.1,
      price: 1.10015,
      provider: 'VT Markets MT5 Demo',
      validForPaperPositionTracking: true,
      validForScalping: false,
    },
    spread: 0.0001,
    spreadBps: 0.9,
    underlyingSymbol: 'EURUSD',
  },
  reason: 'Feed vivo y vela no bloqueante.',
  riskReward: 2.1,
  setupConfirmed: false,
  setupStatus: 'NO_DIRECTIONAL_EDGE',
  source: 'VT_MARKETS_MT5_DEMO',
  strategy: 'SessionMomentum',
  timeframe: 'INTRADAY_SLOW',
  underlyingSymbol: 'EURUSD',
}

const triggered = buildProfitCadenceWatchdog({ account, now, openPositions: [], opportunities: [opportunity] })
assert.strictEqual(triggered.active, true)
assert.strictEqual(triggered.action, 'ESCALATE_CONTROLLED_SCOUT')
assert.strictEqual(triggered.candidateSymbol, 'EURUSD.cfd')

const blockedByMargin = buildProfitCadenceWatchdog({
  account: { ...account, freeMargin: 100, marginLevel: 90 },
  now,
  openPositions: [],
  opportunities: [opportunity],
})
assert.strictEqual(blockedByMargin.active, false)
assert.strictEqual(blockedByMargin.action, 'WAIT_FOR_CAPACITY')

const blockedCandle = buildProfitCadenceWatchdog({
  account,
  now,
  openPositions: [],
  opportunities: [{ ...opportunity, candleBehavior: { score: 20, signal: 'BLOCKS_ENTRY' }, setupStatus: 'CANDLE_BLOCKED' }],
})
assert.strictEqual(blockedCandle.active, false)
assert.strictEqual(blockedCandle.action, 'WAIT_FOR_CANDIDATE')

console.log('test:profit-cadence-watchdog OK')
