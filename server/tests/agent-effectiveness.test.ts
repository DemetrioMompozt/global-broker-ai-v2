import { buildAgentEffectiveness } from '../performance/agentEffectivenessEngine.js'
import { addOpenPosition, closePosition, replaceOpenPositions, type CfdPosition } from '../storage/tradeStore.js'
import { assert, done } from './assert.js'

function position(overrides: Partial<CfdPosition> = {}): CfdPosition {
  return {
    assetClass: 'FOREX_CFD',
    cfdExpertReason: 'test',
    cfdExpertScore: 90,
    cfdSymbol: `EURUSD_${Math.random()}.cfd`,
    currentPrice: 1.101,
    direction: 'LONG',
    entryPrice: 1.1,
    feedType: 'BROKER_DEMO_REALTIME',
    id: `p_${Math.random()}`,
    lastPriceUpdate: new Date().toISOString(),
    leverage: 2,
    managementStatus: 'MANAGING_POSITION',
    marginRequired: 100,
    nextAction: 'HOLD',
    openPnl: 0,
    openPnlPercent: 0,
    openedAt: new Date(Date.now() - 120_000).toISOString(),
    positionSize: 1000,
    previousPrice: 1.1,
    provider: 'VT Markets MT5 Demo',
    riskPercent: 0.1,
    riskUsd: 2.5,
    source: 'VT_MARKETS_MT5_DEMO',
    spreadAtEntry: 0.00001,
    stopLoss: 1.09,
    strategy: 'SessionMomentum',
    takeProfit: 1.12,
    thesis: 'test',
    underlyingSymbol: 'EURUSD',
    ...overrides,
  }
}

function closeAs(exitReason: string, pnl: number, openedMsAgo = 120_000) {
  const item = position({ id: `closed_${Math.random()}`, openedAt: new Date(Date.now() - openedMsAgo).toISOString(), openPnl: pnl })
  addOpenPosition(item)
  const closed = closePosition(item.id, item.currentPrice, exitReason, pnl, pnl)
  assert(closed, 'Trade should close.')
}

replaceOpenPositions([])
closeAs('MICRO_CLOSE_TARGET', 2.05, 180_000)
closeAs('CAPITAL_RECYCLE', -0.25)
closeAs('POSITION_CLOSE_WEAK', -0.15)

const staleOpen = position({ openPnl: -1.2, openedAt: new Date(Date.now() - 2_000_000).toISOString() })
replaceOpenPositions([staleOpen])

let effectiveness = buildAgentEffectiveness({
  account: { balance: 2500, closedPnl: 1.65, equity: 2498.8, freeMargin: 1800, marginLevel: 320, openPnl: -1.2, portfolioLeverage: 0.4, usedMargin: 698.8 },
  activityFeed: [{ action: 'BLOCK_BY_PORTFOLIO_POLICY', reason: 'MAX_POSITIONS_PER_SYMBOL', symbol: 'EURUSD.cfd', time: new Date().toISOString() }],
  blockedOpportunities: [{ cfdSymbol: 'EURUSD.cfd', reason: 'MAX_POSITIONS_PER_SYMBOL' }],
  openPositions: [staleOpen],
})

assert(effectiveness.closedToday === 3, 'Should count closed trades today.')
assert(effectiveness.targetHitsToday === 1, 'Should count target $2 hits.')
assert(effectiveness.rotationsToday === 1, 'Should count rotation closures.')
assert(effectiveness.staleClosuresToday === 1, 'Should count stale closures.')
assert(effectiveness.profitFactorDisplay === 'muestra insuficiente', 'Should not show fake PF before 10 closes.')
assert(effectiveness.stalePositions === 1, 'Should count stale open positions.')

for (let i = 0; i < 7; i += 1) closeAs('MICRO_CLOSE_TARGET', 2.1)

effectiveness = buildAgentEffectiveness({
  account: { balance: 2500, closedPnl: 16.35, equity: 2500, freeMargin: 2000, marginLevel: 350, openPnl: 0, portfolioLeverage: 0.2, usedMargin: 500 },
  activityFeed: [],
  blockedOpportunities: [],
  openPositions: [],
})

assert(effectiveness.closedToday >= 10, 'Should have enough closed trades.')
assert(effectiveness.status === 'EFFECTIVE', `Expected EFFECTIVE, got ${effectiveness.status}: ${effectiveness.reason}`)
assert(effectiveness.expectedPayoff > 0, 'Expected payoff should be positive.')

done('agent-effectiveness')
