import { validateTraderEntryGate } from '../cfd/cfdTraderEntryGate.js'
import type { CfdQuote } from '../cfd/cfdPricingEngine.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'
import { addOpenPosition, closePosition, replaceOpenPositions, type CfdPosition } from '../storage/tradeStore.js'
import { assert, done } from './assert.js'

function quote(symbol = 'EURUSD.cfd'): CfdQuote {
  return {
    ask: 1.10002,
    bid: 1.10001,
    cfdSymbol: symbol,
    feedType: 'BROKER_DEMO_REALTIME',
    lastPriceUpdate: new Date().toISOString(),
    mid: 1.100015,
    pricingQuality: 'LIVE_BID_ASK',
    provider: 'VT Markets MT5 Demo',
    sourcePrice: {
      asset: symbol,
      change: 0.0002,
      changePercent: 0.02,
      feedType: 'BROKER_DEMO_REALTIME',
      isDynamicPriceAvailable: true,
      lastPriceUpdate: new Date().toISOString(),
      mappedSymbol: symbol.replace('.cfd', ''),
      message: 'test',
      previousPrice: 1.0998,
      price: 1.100015,
      provider: 'VT Markets MT5 Demo',
      validForPaperPositionTracking: true,
      validForScalping: false,
    },
    spread: 0.00001,
    spreadBps: 0.09,
    underlyingSymbol: symbol.replace('.cfd', ''),
  }
}

function position(symbol: string): CfdPosition {
  return {
    assetClass: 'FOREX_CFD',
    cfdExpertReason: 'test',
    cfdExpertScore: 90,
    cfdSymbol: symbol,
    currentPrice: 1.1,
    direction: 'LONG',
    entryPrice: 1.11,
    feedType: 'BROKER_DEMO_REALTIME',
    id: `${symbol}_${Math.random()}`,
    lastPriceUpdate: new Date().toISOString(),
    leverage: 10,
    managementStatus: 'MANAGING_POSITION',
    marginRequired: 300,
    nextAction: 'HOLD',
    openPnl: -1,
    openPnlPercent: -0.04,
    openedAt: new Date(Date.now() - 90_000).toISOString(),
    positionSize: 1,
    previousPrice: 1.1,
    provider: 'VT Markets MT5 Demo',
    riskPercent: 0.4,
    riskUsd: 10,
    source: 'VT_MARKETS_MT5_DEMO',
    spreadAtEntry: 0.0001,
    stopLoss: 1,
    strategy: 'SessionMomentum',
    takeProfit: 1.2,
    thesis: 'test',
    underlyingSymbol: symbol.replace('.cfd', ''),
  }
}

function opportunity(symbol = 'EURUSD.cfd', overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    assetClass: 'FOREX_CFD',
    cfdExpertScore: 93,
    cfdSymbol: symbol,
    decision: 'APPROVED',
    direction: 'LONG',
    edgeEfficiency: 0.7,
    edgeMoveBps: 1.6,
    edgePersistence: 0.8,
    edgeRequiredMoveBps: 0.5,
    expectedNetProfit: 4,
    opportunityScore: 95,
    quote: quote(symbol),
    reason: 'strong test',
    riskReward: 2.1,
    setupConfirmed: true,
    setupStatus: 'CONFIRMED',
    source: 'VT_MARKETS_MT5_DEMO',
    strategy: 'SessionMomentum',
    timeframe: 'INTRADAY_SLOW',
    underlyingSymbol: symbol.replace('.cfd', ''),
    ...overrides,
  }
}

replaceOpenPositions([])
for (let index = 0; index < 2; index += 1) {
  const losing = position('EURUSD.cfd')
  addOpenPosition(losing)
  closePosition(losing.id, losing.currentPrice, 'THESIS_INVALIDATED', -0.8)
}

const account = { balance: 2500, equity: 2500, freeMargin: 1800, marginLevel: 260, openPnl: 0, portfolioLeverage: 0, usedMargin: 700 }
const effectiveness = { closedToday: 12, expectedPayoff: -0.4, netProfitToday: -4, status: 'WEAK' as const }

const blocked = validateTraderEntryGate({ account, effectiveness, openPositions: [], opportunity: opportunity('EURUSD.cfd', { cfdExpertScore: 90, opportunityScore: 92, edgePersistence: 0.72, edgeEfficiency: 0.58 }) })
assert(!blocked.approved, 'Memoria de perdidas debe bloquear simbolo suspendido si no hay reversal excepcional.')
assert(blocked.reason.includes('memoria trader'), blocked.reason)

const exceptional = validateTraderEntryGate({ account, effectiveness, openPositions: [], opportunity: opportunity('EURUSD.cfd', { cfdExpertScore: 96, opportunityScore: 98, edgeMoveBps: 2, edgeRequiredMoveBps: 0.5, edgePersistence: 0.85, edgeEfficiency: 0.8 }) })
assert(exceptional.approved, exceptional.reason)

replaceOpenPositions([])
done('trader-firewall')
