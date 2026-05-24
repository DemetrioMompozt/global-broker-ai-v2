import { buildControlledProbeOpportunity } from '../strategy/controlledProbePolicy.js'
import type { CfdQuote } from '../cfd/cfdPricingEngine.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'
import { assert, done } from './assert.js'

const now = new Date().toISOString()
const account = { balance: 2500, closedPnl: 0, equity: 2500, freeMargin: 2500, marginLevel: 9999, openPnl: 0, portfolioLeverage: 0, usedMargin: 0 }

const cryptoQuote: CfdQuote = {
  ask: 1.338,
  bid: 1.336,
  cfdSymbol: 'XRPUSD.cfd',
  feedType: 'REALTIME_TICK',
  lastPriceUpdate: now,
  mid: 1.337,
  pricingQuality: 'LIVE_MID_ESTIMATED_SPREAD',
  provider: 'Binance.US',
  sourcePrice: {
    asset: 'XRPUSD',
    change: 0.002,
    changePercent: 0.12,
    feedType: 'REALTIME_TICK',
    isDynamicPriceAvailable: true,
    lastPriceUpdate: now,
    mappedSymbol: 'XRPUSDT',
    message: 'live',
    previousPrice: 1.335,
    price: 1.337,
    provider: 'Binance.US',
    validForPaperPositionTracking: true,
    validForScalping: false,
  },
  spread: 0.002,
  spreadBps: 10,
  underlyingSymbol: 'XRPUSDT',
}

const cryptoOpportunity: Opportunity = {
  assetClass: 'CRYPTO_CFD',
  candleBehavior: {
    available: true,
    candlesUsed: 3,
    pattern: 'CLOSE_BREAKOUT',
    score: 74,
    signal: 'CONFIRMS_ENTRY',
  },
  candleBehaviorScore: 74,
  candlePattern: 'CLOSE_BREAKOUT',
  cfdExpertScore: 85,
  cfdSymbol: 'XRPUSD.cfd',
  decision: 'WATCH',
  direction: 'LONG',
  expectedNetProfit: 2.6,
  opportunityScore: 88,
  quote: cryptoQuote,
  reason: 'Faltan velas cerradas suficientes para confirmar cripto sin ruido.',
  riskReward: 2.1,
  setupConfirmed: false,
  setupStatus: 'SETUP_FORMING',
  source: 'BINANCE_REALTIME',
  strategy: 'MomentumContinuation',
  timeframe: 'INTRADAY_SLOW',
  underlyingSymbol: 'XRPUSDT',
}

const approved = buildControlledProbeOpportunity({ account, openPositions: [], opportunity: cryptoOpportunity })
assert(approved.approved, approved.reason)
assert(approved.opportunity.setupConfirmed, 'Controlled probe debe convertir la entrada paper en setup operable.')
assert(approved.opportunity.setupStatus === 'CONTROLLED_PROBE', 'Controlled probe debe marcar el setup como CONTROLLED_PROBE.')
assert((approved.opportunity.cfdExpertScore ?? 0) >= 85, 'Controlled probe cripto debe subir el score operativo minimo.')

const insufficientCandles = buildControlledProbeOpportunity({
  account,
  openPositions: [],
  opportunity: {
    ...cryptoOpportunity,
    candleBehavior: {
      available: false,
      candlesUsed: 1,
      pattern: 'INSUFFICIENT_CANDLES',
      score: 50,
      signal: 'NEUTRAL',
    },
    candleBehaviorScore: 50,
    candlePattern: 'INSUFFICIENT_CANDLES',
    setupStatus: 'WAITING_FOR_CANDLES',
  },
})
assert(!insufficientCandles.approved && insufficientCandles.reason.includes('Cripto sigue habilitado'), 'Cripto no debe abrir main paper con velas insuficientes.')

const learningEscape = buildControlledProbeOpportunity({
  account,
  openPositions: [],
  opportunity: {
    ...cryptoOpportunity,
    candleBehavior: {
      available: true,
      candlesUsed: 2,
      pattern: 'NEUTRAL_PULLBACK',
      score: 62,
      signal: 'NEUTRAL',
    },
    candleBehaviorScore: 62,
    cfdExpertScore: 78,
    expectedNetProfit: 1.5,
    opportunityScore: 80,
    setupStatus: 'NO_SETUP',
  },
  relaxed: true,
})
assert(learningEscape.approved, learningEscape.reason)
assert(learningEscape.opportunity.setupStatus === 'LEARNING_ESCAPE_PROBE', 'Watchdog relajado debe convertir a LEARNING_ESCAPE_PROBE para evitar bloqueo permanente.')

const candleBlocked = buildControlledProbeOpportunity({
  account,
  openPositions: [],
  opportunity: { ...cryptoOpportunity, candleBehavior: { ...cryptoOpportunity.candleBehavior as object, signal: 'BLOCKS_ENTRY' } },
})
assert(!candleBlocked.approved && candleBlocked.reason.includes('vela bloquea'), 'No debe abrir si la vela bloquea entrada.')

const vtFlat = buildControlledProbeOpportunity({
  account,
  openPositions: [],
  opportunity: {
    ...cryptoOpportunity,
    assetClass: 'FOREX_CFD',
    cfdExpertScore: 65,
    cfdSymbol: 'EURUSD.cfd',
    opportunityScore: 70,
    quote: { ...cryptoQuote, cfdSymbol: 'EURUSD.cfd', feedType: 'BROKER_DEMO_REALTIME', pricingQuality: 'LIVE_BID_ASK', provider: 'VT Markets MT5 Demo', underlyingSymbol: 'EURUSD' },
    setupStatus: 'NO_DIRECTIONAL_EDGE',
    source: 'VT_MARKETS_MT5_DEMO',
    underlyingSymbol: 'EURUSD',
  },
})
assert(!vtFlat.approved && vtFlat.reason.includes('VT exige movimiento direccional parcial'), 'VT plano no debe abrir solo para llenar operaciones.')

done('controlled-probe-policy')
