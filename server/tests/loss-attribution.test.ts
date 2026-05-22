import assert from 'node:assert'
import { buildLossAttribution } from '../performance/lossAttributionEngine.js'
import { addOpenPosition, closePosition, replaceOpenPositions, type CfdPosition } from '../storage/tradeStore.js'

function position(overrides: Partial<CfdPosition> = {}): CfdPosition {
  return {
    assetClass: 'FOREX_CFD',
    cfdExpertReason: 'test',
    cfdExpertScore: 80,
    cfdSymbol: 'EURUSD.cfd',
    commission: 0.05,
    costToProfitRatio: 0.35,
    currentPrice: 1.1,
    direction: 'LONG',
    entryPrice: 1.11,
    feedType: 'BROKER_DEMO_REALTIME',
    id: `loss_${Math.random()}`,
    lastPriceUpdate: new Date().toISOString(),
    leverage: 25,
    managementStatus: 'MANAGING_POSITION',
    marginRequired: 400,
    nextAction: 'HOLD',
    openPnl: -0.8,
    openPnlPercent: -0.03,
    openedAt: new Date(Date.now() - 60_000).toISOString(),
    positionSize: 10,
    previousPrice: 1.1,
    provider: 'VT Markets MT5 Demo',
    riskPercent: 0.4,
    riskUsd: 10,
    slippageEstimate: 0.05,
    source: 'VT_MARKETS_MT5_DEMO',
    spreadAtEntry: 0.0001,
    spreadCost: 0.1,
    stopLoss: 1,
    strategy: 'SessionMomentum',
    swapAccrued: 0,
    takeProfit: 1.2,
    thesis: 'test',
    totalEstimatedCost: 0.2,
    underlyingSymbol: 'EURUSD',
    ...overrides,
  }
}

replaceOpenPositions([])
const eur = position()
const xau = position({ assetClass: 'METAL_CFD', cfdSymbol: 'XAUUSD.cfd', id: 'loss_xau', openPnl: -1.4, strategy: 'BreakoutConfirmed' })
addOpenPosition(eur)
addOpenPosition(xau)
closePosition(eur.id, eur.currentPrice, 'THESIS_INVALIDATED', -0.8)
closePosition(xau.id, xau.currentPrice, 'THESIS_INVALIDATED', -1.4)

const attribution = buildLossAttribution()

assert(attribution.mainLossDriver === 'bad_entries' || attribution.mainLossDriver === 'leverage' || attribution.mainLossDriver === 'weak_setup', 'Debe atribuir una causa principal.')
assert(attribution.worstSymbols.some((item) => item.symbol === 'XAUUSD.cfd'), 'Debe identificar simbolos perdedores.')
assert(attribution.symbolDiagnostics.some((item) => item.status === 'SUSPEND' || item.status === 'BAN_FOR_SESSION'), 'Simbolos con PF bajo deben suspenderse o banearse.')
assert(attribution.leverageImpact > 0, 'Debe medir impacto de leverage.')
assert(attribution.recommendations.some((item) => item.includes('DEFENSIVE_DIAGNOSTIC_MODE')), 'Debe recomendar mantener diagnostico defensivo.')

replaceOpenPositions([])
console.log('test:loss-attribution OK')
