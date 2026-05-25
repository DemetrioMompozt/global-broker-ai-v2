import { validateEvidenceFirstMainPaperGate } from '../risk/evidenceFirstMainPaperGate.js'
import type { CfdQuote } from '../cfd/cfdPricingEngine.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'
import { assert, done } from './assert.js'

const quote: CfdQuote = {
  ask: 1.20002,
  bid: 1.20001,
  cfdSymbol: 'TESTNOEVIDENCE.cfd',
  feedType: 'BROKER_DEMO_REALTIME' as const,
  lastPriceUpdate: new Date().toISOString(),
  mid: 1.200015,
  pricingQuality: 'LIVE_BID_ASK' as const,
  provider: 'VT Markets MT5 Demo',
  sourcePrice: {
    asset: 'TESTNOEVIDENCE.cfd',
    change: 0.0001,
    changePercent: 0.01,
    feedType: 'BROKER_DEMO_REALTIME' as const,
    isDynamicPriceAvailable: true,
    lastPriceUpdate: new Date().toISOString(),
    mappedSymbol: 'TESTNOEVIDENCE',
    message: 'test',
    previousPrice: 1.1999,
    price: 1.200015,
    provider: 'VT Markets MT5 Demo',
    validForPaperPositionTracking: true,
    validForScalping: false,
  },
  spread: 0.00001,
  spreadBps: 0.08,
  underlyingSymbol: 'TESTNOEVIDENCE',
}

const baseOpportunity: Opportunity = {
  assetClass: 'FOREX_CFD',
  candleBehavior: {
    score: 78,
    signal: 'CONFIRMS_ENTRY',
  },
  cfdExpertScore: 91,
  cfdSymbol: 'TESTNOEVIDENCE.cfd',
  decision: 'APPROVED',
  direction: 'LONG',
  edgeEfficiency: 0.52,
  edgeMoveBps: 1.3,
  edgePersistence: 0.7,
  edgeRequiredMoveBps: 0.5,
  expectedNetProfit: 3.7,
  opportunityScore: 93,
  quote,
  reason: 'test',
  riskReward: 2.1,
  setupConfirmed: true,
  setupStatus: 'CONFIRMED',
  source: 'VT_MARKETS_MT5_DEMO',
  strategy: 'SessionMomentum',
  timeframe: 'INTRADAY_SLOW',
  underlyingSymbol: 'TESTNOEVIDENCE',
}

const attribution = {
  mainLossDriver: 'bad_entries',
  symbolDiagnostics: [],
  worstStrategies: [],
}

const ineffective = {
  closedToday: 20,
  expectedPayoff: -0.68,
  netProfitToday: -13.7,
  principalClosureReason: 'MICRO_TIME_STOP',
  profitFactor: 0.2,
  status: 'INEFFICIENT' as const,
  targetHitsToday: 0,
}

const normal = validateEvidenceFirstMainPaperGate({
  attribution,
  effectiveness: { ...ineffective, closedToday: 2, expectedPayoff: 0, netProfitToday: 0, principalClosureReason: null, profitFactor: null, status: 'MEASURING' as const },
  opportunity: baseOpportunity,
})
assert(normal.approved && !normal.active, normal.reason)

const blocked = validateEvidenceFirstMainPaperGate({
  attribution,
  effectiveness: ineffective,
  opportunity: baseOpportunity,
})
assert(!blocked.approved, 'Losing main paper with zero targets must not keep opening unproven setups.')
assert(blocked.reason.includes('aprendizaje shadow'), blocked.reason)

const elite = validateEvidenceFirstMainPaperGate({
  attribution,
  effectiveness: ineffective,
  opportunity: {
    ...baseOpportunity,
    candleBehavior: { score: 90, signal: 'CONFIRMS_ENTRY' },
    cfdExpertScore: 97,
    edgeEfficiency: 0.8,
    edgeMoveBps: 3.8,
    edgePersistence: 0.9,
    edgeRequiredMoveBps: 1,
    expectedNetProfit: 6,
    opportunityScore: 99,
    riskReward: 2.4,
  },
})
assert(elite.approved, elite.reason)

const banned = validateEvidenceFirstMainPaperGate({
  attribution: {
    ...attribution,
    symbolDiagnostics: [{
      avgLoss: 1,
      avgWin: 0,
      costToProfitRatio: 0.2,
      grossLoss: 4,
      grossProfit: 0,
      maxDrawdown: 4,
      netPnl: -4,
      profitFactor: 0,
      spreadAvg: 0.00001,
      status: 'BAN_FOR_SESSION' as const,
      symbol: 'TESTNOEVIDENCE.cfd',
      trades: 4,
      winRate: 0,
    }],
  },
  effectiveness: ineffective,
  opportunity: {
    ...baseOpportunity,
    candleBehavior: { score: 90, signal: 'CONFIRMS_ENTRY' },
    cfdExpertScore: 97,
    edgeEfficiency: 0.8,
    edgeMoveBps: 3.8,
    edgePersistence: 0.9,
    edgeRequiredMoveBps: 1,
    expectedNetProfit: 6,
    opportunityScore: 99,
  },
})
assert(!banned.approved, 'A session-banned symbol must not reenter main paper even with an elite-looking tick.')

done('evidence-first-main-paper-gate')
