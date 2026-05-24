import { getPerformanceGuardStatus } from '../risk/performanceGuard.js'
import { addOpenPosition, closePosition, type CfdPosition } from '../storage/tradeStore.js'
import { assert, done } from './assert.js'

function position(id: string, pnlSeed: number): CfdPosition {
  return {
    assetClass: 'CRYPTO_CFD',
    cfdExpertReason: 'test',
    cfdExpertScore: 90,
    cfdSymbol: `ETHUSD.cfd`,
    currentPrice: 2000 + pnlSeed,
    direction: 'LONG',
    entryPrice: 2000,
    feedType: 'REALTIME_TICK',
    id,
    lastPriceUpdate: new Date().toISOString(),
    leverage: 1,
    managementStatus: 'MANAGING_POSITION',
    marginRequired: 100,
    nextAction: 'HOLD',
    openPnl: 0,
    openPnlPercent: 0,
    openedAt: new Date().toISOString(),
    positionSize: 1,
    previousPrice: 2000,
    provider: 'Binance',
    riskPercent: 0.4,
    riskUsd: 10,
    source: 'BINANCE_REALTIME',
    spreadAtEntry: 0.1,
    stopLoss: 1990,
    strategy: 'NeverStopTest',
    takeProfit: 2010,
    thesis: 'test',
    underlyingSymbol: 'ETHUSDT',
  }
}

for (let index = 0; index < 25; index += 1) {
  const item = position(`never-stop-${index}`, -2)
  addOpenPosition(item)
  closePosition(item.id, item.currentPrice, 'TEST_LOSS', -2, -2)
}

const guard = getPerformanceGuardStatus()
assert(guard.status === 'APPROVED', 'Paper performance guard must never fully stop the agent.')
assert(guard.reason.includes('nunca se apaga'), 'Guard reason must explain never-stop paper behavior.')

done('never-stop-paper')
