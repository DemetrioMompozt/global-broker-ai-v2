import { validateMultiPositionPortfolioPolicy } from '../risk/multiPositionPortfolioPolicy.js'
import { addOpenPosition, getOpenPositions, replaceOpenPositions, type CfdPosition } from '../storage/tradeStore.js'
import { assert, done } from './assert.js'

function position(overrides: Partial<CfdPosition>): CfdPosition {
  return {
    assetClass: 'FOREX_CFD',
    cfdExpertReason: 'test',
    cfdExpertScore: 88,
    cfdSymbol: 'EURUSD.cfd',
    currentAsk: 1.101,
    currentBid: 1.1,
    currentPrice: 1.1,
    direction: 'LONG',
    entryPrice: 1.1,
    feedType: 'BROKER_DEMO_REALTIME',
    id: `${overrides.cfdSymbol ?? 'EURUSD.cfd'}_${Math.random()}`,
    lastPriceUpdate: new Date().toISOString(),
    leverage: 1,
    managementStatus: 'MANAGING_POSITION',
    marginRequired: 10,
    nextAction: 'HOLD',
    openPnl: 0,
    openPnlPercent: 0,
    openedAt: new Date().toISOString(),
    positionSize: 1,
    previousPrice: 1.1,
    provider: 'VT Markets MT5 Demo',
    riskPercent: 0.2,
    riskUsd: 5,
    source: 'VT_MARKETS_MT5_DEMO',
    spreadAtEntry: 0.001,
    stopLoss: 1,
    strategy: 'Test',
    takeProfit: 1.2,
    thesis: 'test',
    underlyingSymbol: 'EURUSD',
    ...overrides,
  }
}

replaceOpenPositions([])
addOpenPosition(position({ cfdSymbol: 'ETHUSD.cfd', assetClass: 'CRYPTO_CFD', source: 'BINANCE_REALTIME' }))
let policy = validateMultiPositionPortfolioPolicy({ assetClass: 'FOREX_CFD', cfdSymbol: 'EURUSD.cfd', direction: 'LONG', riskPercent: 0.2, source: 'VT_MARKETS_MT5_DEMO' })
assert(policy.approved, 'A crypto position must not block an independent VT forex position.')

addOpenPosition(position({ cfdSymbol: 'EURUSD.cfd' }))
policy = validateMultiPositionPortfolioPolicy({ assetClass: 'FOREX_CFD', cfdSymbol: 'EURUSD.cfd', direction: 'LONG', riskPercent: 0.2, source: 'VT_MARKETS_MT5_DEMO' })
assert(!policy.approved && policy.reasons.some((reason) => reason.includes('MAX_POSITIONS_PER_SYMBOL')), 'Policy must block duplicate symbols.')

replaceOpenPositions([
  position({ cfdSymbol: 'EURUSD.cfd' }),
  position({ cfdSymbol: 'NAS100.cfd', assetClass: 'INDEX_CFD' }),
  position({ cfdSymbol: 'XAUUSD.cfd', assetClass: 'METAL_CFD' }),
  position({ cfdSymbol: 'USDJPY.cfd' }),
  position({ cfdSymbol: 'ETHUSD.cfd', assetClass: 'CRYPTO_CFD', source: 'BINANCE_REALTIME' }),
  position({ cfdSymbol: 'GBPUSD.cfd' }),
  position({ cfdSymbol: 'USDCHF.cfd' }),
  position({ cfdSymbol: 'US500.cfd', assetClass: 'INDEX_CFD' }),
  position({ cfdSymbol: 'BTCUSD.cfd', assetClass: 'CRYPTO_CFD', source: 'BINANCE_REALTIME' }),
  position({ cfdSymbol: 'SOLUSD.cfd', assetClass: 'CRYPTO_CFD', source: 'BINANCE_REALTIME' }),
])
policy = validateMultiPositionPortfolioPolicy({ assetClass: 'FOREX_CFD', cfdSymbol: 'USDCHF.cfd', direction: 'LONG', riskPercent: 0.2, source: 'VT_MARKETS_MT5_DEMO' })
assert(!policy.approved && policy.reasons.some((reason) => reason.includes('MAX_TOTAL_OPEN_POSITIONS')), 'Policy must block above 10 total positions.')

replaceOpenPositions([])
assert(getOpenPositions().length === 0, 'Test cleanup should clear open positions.')
done('multi-position-policy')
