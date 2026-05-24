import { evaluateProfessionalTradingLibrarySkill, getProfessionalTradingLibrarySkillStatus, getProfessionalTradingLibrarySystemPrompt } from '../learning/professionalTradingLibrarySkill.js'
import type { CfdQuote } from '../cfd/cfdPricingEngine.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'
import { assert, done } from './assert.js'

const quote: CfdQuote = {
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
    change: 0.0002,
    changePercent: 0.02,
    feedType: 'BROKER_DEMO_REALTIME',
    isDynamicPriceAvailable: true,
    lastPriceUpdate: new Date().toISOString(),
    mappedSymbol: 'EURUSD',
    message: 'test',
    previousPrice: 1.0998,
    price: 1.100015,
    provider: 'VT Markets MT5 Demo',
    validForPaperPositionTracking: true,
    validForScalping: false,
  },
  spread: 0.00001,
  spreadBps: 0.09,
  underlyingSymbol: 'EURUSD',
}

const confirmedCandle = {
  available: true,
  bodyRatio: 0.56,
  breakoutConfirmed: true,
  candlesUsed: 6,
  directionAligned: true,
  exhaustionAgainst: false,
  pattern: 'COMPRESSION_BREAKOUT',
  reason: 'Vela cerrada confirma ruptura.',
  rejectionConfirmed: false,
  score: 84,
  signal: 'CONFIRMS_ENTRY',
  timeframe: '1m',
  trendAligned: true,
}

const opportunity: Opportunity = {
  assetClass: 'FOREX_CFD',
  cfdExpertScore: 90,
  cfdSymbol: 'EURUSD.cfd',
  candleBehavior: confirmedCandle,
  candleBehaviorScore: 84,
  candlePattern: 'COMPRESSION_BREAKOUT',
  decision: 'APPROVED',
  direction: 'LONG',
  edgeEfficiency: 0.7,
  edgeMoveBps: 2.2,
  edgePersistence: 0.8,
  edgeRequiredMoveBps: 1,
  expectedNetProfit: 3.2,
  opportunityScore: 92,
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

const status = getProfessionalTradingLibrarySkillStatus()
assert(status.enabled, 'Professional library skill must be always on.')
assert(status.booksLoaded === 10, 'Professional library must load 10 books.')
assert(status.copyrightPolicy.includes('no se cargan PDFs'), 'Must not load copyrighted full books.')
assert(status.corePrinciples.every((principle) => principle.length < 180), 'Principles must be concise original operating rules.')

const approved = evaluateProfessionalTradingLibrarySkill(opportunity)
assert(approved.approved, approved.reason)
assert(approved.confirmations.length >= 3, 'Approved setup should show confirmations.')

const badCandle = evaluateProfessionalTradingLibrarySkill({
  ...opportunity,
  candleBehavior: { ...confirmedCandle, reason: 'Falla ruptura.', score: 42, signal: 'BLOCKS_ENTRY' },
  setupConfirmed: true,
})
assert(!badCandle.approved && badCandle.reason.includes('vela'), 'Must block candle behavior that blocks entry.')

const noEdge = evaluateProfessionalTradingLibrarySkill({ ...opportunity, expectedNetProfit: 1.2 })
assert(!noEdge.approved && noEdge.reason.includes('expected net'), 'Must block expected net below target.')

const noMove = evaluateProfessionalTradingLibrarySkill({ ...opportunity, edgeMoveBps: 0.3, edgeRequiredMoveBps: 1 })
assert(!noMove.approved && noMove.reason.includes('movimiento disponible'), 'Must block when remaining movement is too thin.')

const prompt = getProfessionalTradingLibrarySystemPrompt()
assert(prompt.includes('Biblioteca profesional'), 'Prompt must include permanent library context.')
assert(prompt.includes('Research only'), 'Prompt must keep GPT research non-operational.')

done('professional-trading-library-skill')
