import { buildLossPatternFirewallStatus, validateLossPatternFirewall } from '../risk/lossPatternFirewall.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'
import { assert, done } from './assert.js'

const baseEffectiveness = {
  closedToday: 33,
  expectedPayoff: -0.77,
  netProfitToday: -25.39,
  principalClosureReason: 'CRYPTO_FAST_INVALIDATION',
  profitFactor: 0.1,
  status: 'INEFFICIENT' as const,
  targetHitsToday: 0,
}

const attribution = {
  mainLossDriver: 'weak_setup',
  symbolDiagnostics: [
    {
      avgLoss: 0.9,
      avgWin: 0,
      costToProfitRatio: 0.2,
      grossLoss: 8,
      grossProfit: 0,
      maxDrawdown: 8,
      netPnl: -8,
      profitFactor: 0,
      spreadAvg: 0.1,
      status: 'SUSPEND' as const,
      symbol: 'BTCUSD.cfd',
      trades: 9,
      winRate: 0,
    },
  ],
  worstStrategies: [{ name: 'MomentumContinuation', netPnl: -6, trades: 8 }],
}

const cryptoOpportunity: Opportunity = {
  assetClass: 'CRYPTO_CFD',
  candleBehavior: { signal: 'NEUTRAL', score: 58 },
  cfdExpertScore: 88,
  cfdSymbol: 'BTCUSD.cfd',
  direction: 'LONG',
  expectedNetProfit: 3,
  opportunityScore: 90,
  quote: {
    ask: 100,
    bid: 99.9,
    cfdSymbol: 'BTCUSD.cfd',
    feedType: 'REALTIME_TICK',
    lastPriceUpdate: new Date().toISOString(),
    mid: 99.95,
    pricingQuality: 'LIVE_MID_ESTIMATED_SPREAD',
    provider: 'Binance',
    sourcePrice: {
      asset: 'BTCUSD',
      change: 1,
      changePercent: 0.1,
      feedType: 'REALTIME_TICK',
      isDynamicPriceAvailable: true,
      lastPriceUpdate: new Date().toISOString(),
      mappedSymbol: 'BTCUSDT',
      message: 'test',
      previousPrice: 99,
      price: 99.95,
      provider: 'Binance',
      validForPaperPositionTracking: true,
      validForScalping: false,
    },
    spread: 0.1,
    spreadBps: 10,
    underlyingSymbol: 'BTCUSDT',
  },
  reason: 'test',
  riskReward: 2.1,
  setupConfirmed: true,
  setupStatus: 'CONTROLLED_PROBE',
  source: 'BINANCE_REALTIME',
  strategy: 'MomentumContinuation',
  timeframe: 'INTRADAY_SLOW',
  underlyingSymbol: 'BTCUSDT',
}

const status = buildLossPatternFirewallStatus({ attribution, effectiveness: baseEffectiveness })
assert(status.active, 'Firewall must activate after repeated crypto fast invalidations with no target hits.')
assert(status.shadowLearningRecommended, 'Firewall must recommend shadow learning, not agent shutdown.')

const cryptoAllowed = validateLossPatternFirewall({ attribution, effectiveness: baseEffectiveness, opportunity: cryptoOpportunity })
assert(cryptoAllowed.approved, cryptoAllowed.reason)

const candleBlocked = validateLossPatternFirewall({
  attribution,
  effectiveness: baseEffectiveness,
  opportunity: { ...cryptoOpportunity, candleBehavior: { signal: 'BLOCKS_ENTRY', score: 30 } },
})
assert(!candleBlocked.approved, 'Crypto should only be blocked by direct candle/data safety, not by asset class memory.')

const exceptional = validateLossPatternFirewall({
  attribution,
  effectiveness: baseEffectiveness,
  opportunity: {
    ...cryptoOpportunity,
    candleBehavior: { signal: 'CONFIRMS_ENTRY', score: 82 },
    cfdExpertScore: 95,
    cfdSymbol: 'ETHUSD.cfd',
    opportunityScore: 98,
  },
})
assert(exceptional.approved, exceptional.reason)

done('loss-pattern-firewall')
