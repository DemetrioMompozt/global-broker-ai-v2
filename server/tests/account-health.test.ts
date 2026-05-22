import assert from 'node:assert'
import { evaluateCapitalRecycling } from '../cfd/capitalRecyclingEngine.js'
import { reviewOpenPositions } from '../cfd/positionRotationEngine.js'
import { getMicroProfitTargetNetUsd } from '../config/microProfitConfig.js'
import { getSafetyConfig } from '../config/safetyConfig.js'
import { getPerformanceSummary } from '../performance/performanceEngine.js'
import { evaluateAccountHealth } from '../risk/accountHealthGuard.js'
import { evaluateSampleSize } from '../risk/sampleSizeGuard.js'
import { replaceOpenPositions, type CfdPosition } from '../storage/tradeStore.js'

function position(overrides: Partial<CfdPosition> = {}): CfdPosition {
  return {
    assetClass: 'FOREX_CFD',
    cfdExpertReason: 'test',
    cfdExpertScore: 60,
    cfdSymbol: 'EURUSD.cfd',
    currentPrice: 1.1,
    direction: 'LONG',
    entryPrice: 1.11,
    feedType: 'BROKER_DEMO_REALTIME',
    id: `p_${Math.random()}`,
    lastPriceUpdate: new Date().toISOString(),
    leverage: 1,
    managementStatus: 'MANAGING_POSITION',
    marginRequired: 1000,
    nextAction: 'HOLD',
    openPnl: -1,
    openPnlPercent: -0.04,
    openedAt: new Date(Date.now() - 400_000).toISOString(),
    positionSize: 1,
    previousPrice: 1.1,
    provider: 'VT Markets MT5 Demo',
    riskPercent: 0.2,
    riskUsd: 5,
    source: 'VT_MARKETS_MT5_DEMO',
    spreadAtEntry: 0.0001,
    stopLoss: 1,
    strategy: 'Test',
    takeProfit: 1.2,
    thesis: 'test',
    underlyingSymbol: 'EURUSD',
    ...overrides,
  }
}

const positions = [
  position({ cfdSymbol: 'EURUSD.cfd', marginRequired: 900, openPnl: -0.5 }),
  position({ cfdSymbol: 'NAS100.cfd', assetClass: 'INDEX_CFD', marginRequired: 1200, openPnl: -2 }),
]

let health = evaluateAccountHealth({
  balance: 2500,
  equity: 2498,
  freeMargin: -100,
  marginLevel: 180,
  openPnl: -2,
  portfolioLeverage: 2,
  usedMargin: 2600,
}, positions)
assert.strictEqual(health.accountHealth, 'CRITICAL_MARGIN_DEFENSIVE', 'freeMargin negativo activa CRITICAL_MARGIN_DEFENSIVE.')
assert(health.blockNewEntries, 'freeMargin negativo bloquea nuevas entradas.')
assert(health.needsMarginRelease, 'freeMargin negativo activa revision/cierre.')
assert.strictEqual(health.maxAllowedOpenPositions, 0, 'freeMargin negativo no permite nuevas posiciones.')

health = evaluateAccountHealth({
  balance: 2500,
  equity: 2500,
  freeMargin: 400,
  marginLevel: 250,
  openPnl: 0,
  portfolioLeverage: 1,
  usedMargin: 2100,
}, positions)
assert.strictEqual(health.accountHealth, 'HEALTHY', 'Modo demo agresivo permite seguir buscando si free margin y margin level siguen sanos.')

health = evaluateAccountHealth({
  balance: 2500,
  equity: 2500,
  freeMargin: 40,
  marginLevel: 100,
  openPnl: 0,
  portfolioLeverage: 1,
  usedMargin: 2460,
}, positions)
assert(health.blockNewEntries, 'Margin level menor a 105% o free margin muy bajo bloquea nuevas entradas.')

const healthy = evaluateAccountHealth({
  balance: 2500,
  equity: 2600,
  freeMargin: 1800,
  marginLevel: 350,
  openPnl: 10,
  portfolioLeverage: 1,
  usedMargin: 600,
}, [])
assert.strictEqual(healthy.maxAllowedOpenPositions, 10, 'Hasta 10 posiciones solo con margen sano y sizing dinamico.')

const rotation = reviewOpenPositions({
  account: { balance: 2500, equity: 2498, freeMargin: -100, marginLevel: 180, openPnl: -2, portfolioLeverage: 2, usedMargin: 2600 },
  accountHealth: 'CRITICAL_MARGIN_DEFENSIVE',
  opportunities: [],
  positions,
})
assert(rotation.weakestPosition?.position.cfdSymbol === 'NAS100.cfd', 'PositionRotationEngine identifica peor posicion por margen/P/L.')

const recycle = evaluateCapitalRecycling({ bestOpportunity: null, costToSwitch: 10, weakestPosition: rotation.weakestPosition })
assert(!recycle.approved, 'CapitalRecyclingEngine no rota si no hay oportunidad superior clara.')

replaceOpenPositions([])
const sample = evaluateSampleSize()
assert(sample.insufficientSample, 'Profit factor con muestra pequena debe ser insuficiente.')
assert(getPerformanceSummary().sampleSizeStatus === 'INSUFFICIENT_SAMPLE', 'Performance debe marcar muestra insuficiente.')
assert.strictEqual(getMicroProfitTargetNetUsd(), 2, 'Micro target default debe ser $2.')

const safety = getSafetyConfig()
assert.strictEqual(safety.realTradingAllowed, false)
assert.strictEqual(safety.brokerExecutionEnabled, false)

console.log('test:account-health OK')
