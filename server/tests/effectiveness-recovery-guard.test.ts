import { validateRecoveryCandidate } from '../risk/effectivenessRecoveryGuard.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'
import { assert, done } from './assert.js'

const quote = {
  ask: 1.10002,
  bid: 1.10001,
  cfdSymbol: 'EURUSD.cfd',
  feedType: 'BROKER_DEMO_REALTIME',
  lastPriceUpdate: new Date().toISOString(),
  mid: 1.100015,
  pricingQuality: 'LIVE_BID_ASK',
  provider: 'VT Markets MT5 Demo',
  sourcePrice: {
    asset: 'EURUSD.cfd',
    change: 0.00001,
    changePercent: 0.001,
    feedType: 'BROKER_DEMO_REALTIME',
    isDynamicPriceAvailable: true,
    lastPriceUpdate: new Date().toISOString(),
    mappedSymbol: 'EURUSD',
    message: 'test',
    previousPrice: 1.1,
    price: 1.100015,
    provider: 'VT Markets MT5 Demo',
    validForPaperPositionTracking: true,
    validForScalping: false,
  },
  spread: 0.00001,
  spreadBps: 0.09,
  underlyingSymbol: 'EURUSD',
} as Opportunity['quote']

const baseOpportunity: Opportunity = {
  assetClass: 'FOREX_CFD',
  cfdExpertScore: 91,
  cfdSymbol: 'EURUSD.cfd',
  decision: 'APPROVED',
  direction: 'LONG',
  edgeEfficiency: 0.5,
  edgeMoveBps: 1,
  edgePersistence: 0.72,
  edgeRequiredMoveBps: 0.5,
  expectedNetProfit: 3.8,
  opportunityScore: 93,
  quote,
  reason: 'test',
  riskReward: 2.1,
  setupConfirmed: true,
  setupStatus: 'CONFIRMED',
  source: 'VT_MARKETS_MT5_DEMO',
  strategy: 'SessionMomentum',
  timeframe: 'INTRADAY_SLOW',
  underlyingSymbol: 'EURUSD',
}

const ineffective = {
  closedToday: 23,
  expectedPayoff: -0.2,
  netProfitToday: -6,
  principalClosureReason: 'THESIS_INVALIDATED',
  profitFactor: 0.59,
  status: 'INEFFICIENT' as const,
  targetHitsToday: 4,
}

const approved = validateRecoveryCandidate({ effectiveness: ineffective, opportunity: { ...baseOpportunity, edgeMoveBps: 1.4 } })
assert(approved.approved, approved.reason)

const weak = validateRecoveryCandidate({ effectiveness: ineffective, opportunity: { ...baseOpportunity, cfdExpertScore: 85, edgeEfficiency: 0.22, opportunityScore: 88 } })
assert(!weak.approved, 'Inefficient mode must block weak repeat entries.')
assert(weak.reason.includes('Recovery guard bloquea'), 'Block reason should be explicit.')

const normal = validateRecoveryCandidate({ effectiveness: { ...ineffective, closedToday: 2, expectedPayoff: 0, netProfitToday: 0, principalClosureReason: null, profitFactor: null, status: 'MEASURING' as const }, opportunity: weak.approved ? baseOpportunity : { ...baseOpportunity, opportunityScore: 85 } })
assert(normal.approved, 'Recovery guard should not apply in measuring mode.')

done('effectiveness-recovery-guard')
