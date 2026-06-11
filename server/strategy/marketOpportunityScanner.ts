import { getCfdQuote, type CfdQuote } from '../cfd/cfdPricingEngine.js'
import { getSafetyConfig, hasRealTradingViolation } from '../config/safetyConfig.js'
import { getCfdInstrument, getTradableInstruments } from '../symbols/cfdInstrumentRegistry.js'
import { buildAdaptiveTargetCandidatesForSymbol } from './adaptiveTargetEngine.js'

export type MarketOpportunityDecision =
  | 'VIABLE'
  | 'PREPARED'
  | 'TEMPORARILY_REJECTED'
  | 'FEED_INVALID'
  | 'MARKET_TOO_EXPENSIVE'
  | 'INSUFFICIENT_VOLATILITY'
  | 'NO_EDGE'

export type MarketOpportunityAgentState =
  | 'WATCHING_MARKETS'
  | 'SCANNING_OPPORTUNITIES'
  | 'FEED_INVALID'
  | 'MARKET_TOO_EXPENSIVE'
  | 'INSUFFICIENT_VOLATILITY'
  | 'TARGET_ADJUSTMENT_REQUIRED'
  | 'OPPORTUNITY_FOUND'
  | 'PAPER_TRADE_READY'
  | 'PAPER_TRADE_RUNNING'
  | 'TEMPORARILY_REJECTED'
  | 'NO_EDGE_AVAILABLE'

export type AdaptiveTargetCandidate = {
  costPct: number
  expectedNetProfit: number
  moveRatio: number
  requiredMoveBps: number
  score: number
  spreadPct: number
  targetNetUsd: number
  totalCost: number
  viable: boolean
}

export type MarketOpportunityRow = {
  ask: number | null
  bid: number | null
  brokerSymbol?: string | null
  cooldownUntil: string | null
  costPct: number | null
  decision: MarketOpportunityDecision
  direction?: 'LONG' | 'SHORT'
  feedStatus: string
  lastPriceUpdate: string | null
  moveRatio: number | null
  nextAction: string
  nextCheckAt: string
  observedMoveBps: number
  reason: string
  requiredMoveBps: number | null
  score: number
  selectedTarget: AdaptiveTargetCandidate | null
  session: string
  spreadBps: number | null
  spreadPct: number | null
  source?: 'MARKET_SCANNER' | 'DOW_THEORY_CANDIDATE' | 'ACTIVE_EXPERT_PRESSURE' | 'TRADER_VIDEO_REPLICATION_MODE'
  symbol: string
  targetCandidate: number | null
}

export type MarketOpportunityScannerStatus = {
  activeEvaluationWindowMinutes: number
  agentState: MarketOpportunityAgentState
  baseSymbol: string
  config: MarketOpportunityScannerConfig
  cooldowns: Array<{ cooldownUntil: string; reason: string; symbol: string }>
  generatedAt: string
  previousTarget: number | null
  reason: string
  recommendedSymbol: string | null
  recommendedTarget: number | null
  rows: MarketOpportunityRow[]
  safety: {
    brokerExecutionEnabled: false
    paperOnly: true
    realTradingAllowed: false
  }
  selected: MarketOpportunityRow | null
  symbolPriority: string[]
}

export type V3DiagnosticStatus = {
  action: string
  currentSymbol: string
  currentTarget: number
  explanation: string
  missing: string[]
  primaryProblem: 'FEED' | 'SPREAD' | 'COST' | 'VOLATILITY' | 'TARGET' | 'NONE'
  scannerState: MarketOpportunityAgentState
  selectedAlternative: string | null
  selectedAlternativeTarget: number | null
}

export type MarketOpportunityScannerConfig = {
  activeEvaluationWindowMinutes: number
  consecutiveRejectChecks: number
  cooldownMinutes: number
  maxCostPctOfTarget: number
  maxSpreadPctOfTarget: number
  minObservedMoveRatio: number
  paperNotionalUsd: number
  quoteFreshnessMs: number
  rejectCheckSpacingMs: number
  targetCandidatesUsd: number[]
}

type SymbolState = {
  cooldownReason?: string
  cooldownUntil?: number
  consecutiveRejects: number
  firstPreparedAt?: number
  lastRejectAt?: number
  observations: Array<{ mid: number; timestamp: number }>
}

export const marketScannerBaseSymbol = 'EURUSD.cfd'

const balancedMarketScannerPriority = [
  'ETHUSD.cfd',
  'BTCUSD.cfd',
  'SOLUSD.cfd',
  'XRPUSD.cfd',
  'NAS100.cfd',
  'US500.cfd',
  'US30.cfd',
  'GER40.cfd',
  'UK100.cfd',
  'JPN225.cfd',
  'HK50.cfd',
  'VIX.cfd',
  'XAUUSD.cfd',
  'XAGUSD.cfd',
  'EURUSD.cfd',
  'GBPUSD.cfd',
  'USDJPY.cfd',
  'AUDUSD.cfd',
  'USDCAD.cfd',
  'USDCHF.cfd',
  'EURJPY.cfd',
  'GBPJPY.cfd',
  'AUDJPY.cfd',
  'NZDUSD.cfd',
]

function uniqueSymbols(symbols: string[]) {
  const seen = new Set<string>()
  return symbols.filter((symbol) => {
    const key = symbol.toUpperCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function symbolListEnv(name: string, fallback: string[]) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = raw.split(',').map((item) => item.trim()).filter(Boolean)
  return parsed.length ? parsed : fallback
}

export const marketScannerSymbolPriority = symbolListEnv(
  'MARKET_SCANNER_SYMBOLS',
  uniqueSymbols([
    ...balancedMarketScannerPriority,
    ...getTradableInstruments().map((instrument) => instrument.cfdSymbol),
  ]),
)

const symbolState = new Map<string, SymbolState>()

function numberEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name])
  return Number.isFinite(parsed) ? parsed : fallback
}

export const marketOpportunityScannerConfig: MarketOpportunityScannerConfig = {
  activeEvaluationWindowMinutes: numberEnv('MARKET_SCANNER_ACTIVE_EVALUATION_WINDOW_MINUTES', 60),
  consecutiveRejectChecks: numberEnv('MARKET_SCANNER_CONSECUTIVE_REJECT_CHECKS', 3),
  cooldownMinutes: numberEnv('MARKET_SCANNER_COOLDOWN_MINUTES', 30),
  maxCostPctOfTarget: numberEnv('MARKET_SCANNER_MAX_COST_PCT_OF_TARGET', 30),
  maxSpreadPctOfTarget: numberEnv('MARKET_SCANNER_MAX_SPREAD_PCT_OF_TARGET', 20),
  minObservedMoveRatio: numberEnv('MARKET_SCANNER_MIN_OBSERVED_MOVE_RATIO', 0.5),
  paperNotionalUsd: numberEnv('MARKET_SCANNER_PAPER_NOTIONAL_USD', 50),
  quoteFreshnessMs: numberEnv('MARKET_SCANNER_QUOTE_FRESHNESS_MS', 120_000),
  rejectCheckSpacingMs: numberEnv('MARKET_SCANNER_REJECT_CHECK_SPACING_MS', 60_000),
  targetCandidatesUsd: [0.02, 0.03, 0.05, 0.08, 0.1, 0.15, 0.2, 0.25, 0.35, 0.5],
}

function stateFor(symbol: string) {
  const existing = symbolState.get(symbol)
  if (existing) return existing
  const created: SymbolState = { consecutiveRejects: 0, observations: [] }
  symbolState.set(symbol, created)
  return created
}

export function resetMarketOpportunityScannerState() {
  symbolState.clear()
}

function round(value: number | null | undefined, decimals = 6) {
  return typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(decimals)) : 0
}

function currentSession(now = new Date()) {
  const hour = now.getUTCHours()
  if (hour >= 0 && hour < 7) return 'ASIA_THIN'
  if (hour >= 7 && hour < 13) return 'LONDON'
  if (hour >= 13 && hour < 17) return 'NY_OVERLAP'
  if (hour >= 17 && hour < 21) return 'NY_AFTERNOON'
  return 'QUIET'
}

function sessionScore(symbol: string, now: Date) {
  const session = currentSession(now)
  const instrument = getCfdInstrument(symbol)
  if (instrument?.assetClass === 'CRYPTO_CFD') return 10
  if (instrument?.assetClass === 'INDEX_CFD') return session === 'NY_OVERLAP' || session === 'NY_AFTERNOON' ? 10 : 4
  if (instrument?.assetClass === 'METAL_CFD') return session === 'LONDON' || session === 'NY_OVERLAP' ? 10 : 7
  if (instrument?.assetClass === 'FOREX_CFD') return session === 'QUIET' ? 5 : 8
  return 5
}

function invalidFeedReason(quote: CfdQuote | null, now: Date, config: MarketOpportunityScannerConfig) {
  if (!quote) return 'No hay quote.'
  if (!Number.isFinite(quote.bid) || !Number.isFinite(quote.ask) || quote.bid <= 0 || quote.ask <= 0) return 'Bid/ask invalido.'
  if (quote.feedType === 'MOCK_DATA' || quote.feedType === 'STALE_DATA' || quote.feedType === 'DELAYED_INTRADAY' || quote.feedType === 'ERROR') return `Feed no operable: ${quote.feedType}.`
  if (quote.pricingQuality === 'ERROR') return 'Pricing quality ERROR.'
  const last = new Date(quote.lastPriceUpdate).getTime()
  if (!Number.isFinite(last)) return 'Timestamp de precio invalido.'
  if (now.getTime() - last > config.quoteFreshnessMs) return 'Precio stale.'
  if (quote.feedType === 'BROKER_DEMO_REALTIME' && quote.pricingQuality !== 'LIVE_BID_ASK') return 'VT requiere LIVE_BID_ASK.'
  if (quote.feedType !== 'BROKER_DEMO_REALTIME' && quote.feedType !== 'REALTIME_TICK') return `Feed ${quote.feedType} no autorizado para entradas paper.`
  return null
}

function updateObservedMove(symbol: string, quote: CfdQuote | null, now: Date, config: MarketOpportunityScannerConfig) {
  const state = stateFor(symbol)
  const cutoff = now.getTime() - config.activeEvaluationWindowMinutes * 60_000
  state.observations = state.observations.filter((item) => item.timestamp >= cutoff)
  if (quote && Number.isFinite(quote.mid) && quote.mid > 0) {
    state.observations.push({ mid: quote.mid, timestamp: now.getTime() })
  }
  if (state.observations.length >= 2) {
    const mids = state.observations.map((item) => item.mid)
    const min = Math.min(...mids)
    const max = Math.max(...mids)
    const avg = mids.reduce((sum, value) => sum + value, 0) / mids.length
    return avg > 0 ? (max - min) / avg * 10_000 : 0
  }
  const changeBps = Math.abs(quote?.sourcePrice?.changePercent ?? 0) * 100
  return Number.isFinite(changeBps) ? changeBps : 0
}

export function buildAdaptiveTargetCandidates(input: {
  config?: MarketOpportunityScannerConfig
  observedMoveBps: number
  quote: Pick<CfdQuote, 'spreadBps'>
  symbol?: string
}) {
  const config = input.config ?? marketOpportunityScannerConfig
  return buildAdaptiveTargetCandidatesForSymbol({
    config,
    observedMoveBps: input.observedMoveBps,
    quote: input.quote,
    symbol: input.symbol ?? 'UNKNOWN',
  })
}

function chooseTarget(candidates: AdaptiveTargetCandidate[]) {
  const strong = candidates.filter((item) => item.viable && item.moveRatio >= 1).sort((a, b) => a.targetNetUsd - b.targetNetUsd)[0]
  if (strong) return strong
  return candidates.filter((item) => item.viable).sort((a, b) => a.targetNetUsd - b.targetNetUsd)[0] ?? null
}

function chooseDiagnosticTarget(candidates: AdaptiveTargetCandidate[], config: MarketOpportunityScannerConfig) {
  const viable = chooseTarget(candidates)
  if (viable) return viable
  const costSafe = candidates
    .filter((item) =>
      item.expectedNetProfit > 0 &&
      item.spreadPct <= config.maxSpreadPctOfTarget &&
      item.costPct <= config.maxCostPctOfTarget
    )
    .sort((a, b) => a.requiredMoveBps - b.requiredMoveBps)[0]
  if (costSafe) return costSafe
  return [...candidates].sort((a, b) => b.score - a.score)[0] ?? null
}

function opportunityScore(input: {
  config: MarketOpportunityScannerConfig
  feedValid: boolean
  selected: AdaptiveTargetCandidate | null
  sessionScore: number
}) {
  if (!input.feedValid || !input.selected) return 0
  const feedHealthScore = 25
  const spreadScore = Math.max(0, Math.min(20, 20 * (1 - input.selected.spreadPct / input.config.maxSpreadPctOfTarget)))
  const costScore = Math.max(0, Math.min(20, 20 * (1 - input.selected.costPct / input.config.maxCostPctOfTarget)))
  const volatilityScore = Math.max(0, Math.min(25, 25 * Math.min(input.selected.moveRatio, 1)))
  let score = feedHealthScore + spreadScore + costScore + volatilityScore + input.sessionScore
  if (input.selected.spreadPct > input.config.maxSpreadPctOfTarget || input.selected.costPct > input.config.maxCostPctOfTarget) score = Math.min(score, 40)
  if (input.selected.moveRatio < input.config.minObservedMoveRatio) score = Math.min(score, 50)
  return round(score, 2)
}

function rowDecision(input: {
  config: MarketOpportunityScannerConfig
  feedReason: string | null
  observedMoveBps: number
  score: number
  selected: AdaptiveTargetCandidate | null
}) {
  if (input.feedReason) return { decision: 'FEED_INVALID' as const, reason: input.feedReason }
  const bestByCost = input.selected
  if (!bestByCost) {
    const cheapest = input.selected
    return { decision: 'NO_EDGE' as const, reason: cheapest ? 'No hay target viable.' : 'Ningun target candidato cumple costo/spread/volatilidad.' }
  }
  if (bestByCost.spreadPct > input.config.maxSpreadPctOfTarget || bestByCost.costPct > input.config.maxCostPctOfTarget) {
    return { decision: 'MARKET_TOO_EXPENSIVE' as const, reason: `Spread/costo fuera de regla para target $${bestByCost.targetNetUsd.toFixed(2)}.` }
  }
  if (bestByCost.moveRatio < input.config.minObservedMoveRatio) {
    return { decision: 'INSUFFICIENT_VOLATILITY' as const, reason: `Movimiento observado ${input.observedMoveBps.toFixed(2)} bps no llega al 50% de ${bestByCost.requiredMoveBps.toFixed(2)} bps requeridos.` }
  }
  if (input.score >= 75) return { decision: 'VIABLE' as const, reason: `Score ${input.score}; target adaptativo $${bestByCost.targetNetUsd.toFixed(2)} viable.` }
  if (input.score >= 60) return { decision: 'PREPARED' as const, reason: `Score ${input.score}; observar antes de autorizar.` }
  return { decision: 'NO_EDGE' as const, reason: `Score ${input.score}; sin edge medible.` }
}

export function evaluateMarketOpportunity(input: {
  config?: MarketOpportunityScannerConfig
  now?: Date
  observedMoveBps?: number
  quote: CfdQuote | null
  symbol: string
}) {
  const config = input.config ?? marketOpportunityScannerConfig
  const now = input.now ?? new Date()
  const state = stateFor(input.symbol)
  const nextCheckAt = new Date(now.getTime() + 5_000).toISOString()
  const cooldownActive = state.cooldownUntil && state.cooldownUntil > now.getTime()
  const feedReason = invalidFeedReason(input.quote, now, config)
  const observedMoveBps = input.observedMoveBps ?? updateObservedMove(input.symbol, input.quote, now, config)
  const candidates = input.quote ? buildAdaptiveTargetCandidates({ config, observedMoveBps, quote: input.quote, symbol: input.symbol }) : []
  const selected = chooseDiagnosticTarget(candidates, config)
  const score = opportunityScore({ config, feedValid: !feedReason, selected, sessionScore: sessionScore(input.symbol, now) })
  const baseDecision = rowDecision({ config, feedReason, observedMoveBps, score, selected })
  let decision: MarketOpportunityDecision = baseDecision.decision
  let reason = baseDecision.reason

  if (cooldownActive) {
    decision = 'TEMPORARILY_REJECTED'
    reason = state.cooldownReason ?? 'Cooldown activo por rechazos consecutivos.'
  } else if (decision === 'PREPARED' && state.firstPreparedAt && now.getTime() - state.firstPreparedAt >= config.activeEvaluationWindowMinutes * 60_000) {
    decision = 'TEMPORARILY_REJECTED'
    reason = 'PREPARED excedio ventana activa sin volverse viable.'
    state.cooldownUntil = now.getTime() + config.cooldownMinutes * 60_000
    state.cooldownReason = reason
  }

  if (decision === 'PREPARED' && !state.firstPreparedAt) state.firstPreparedAt = now.getTime()
  if (decision === 'VIABLE') {
    state.consecutiveRejects = 0
    state.firstPreparedAt = undefined
    state.lastRejectAt = undefined
    state.cooldownUntil = undefined
    state.cooldownReason = undefined
  } else if (!cooldownActive && decision !== 'PREPARED') {
    if (!state.lastRejectAt || now.getTime() - state.lastRejectAt >= config.rejectCheckSpacingMs) {
      state.consecutiveRejects += 1
      state.lastRejectAt = now.getTime()
    }
    if (state.consecutiveRejects >= config.consecutiveRejectChecks && decision !== 'FEED_INVALID') {
      state.cooldownUntil = now.getTime() + config.cooldownMinutes * 60_000
      state.cooldownReason = `${decision}: ${reason}`
      decision = 'TEMPORARILY_REJECTED'
      reason = state.cooldownReason
    }
  }

  return {
    candidates,
    row: {
      ask: input.quote && Number.isFinite(input.quote.ask) ? input.quote.ask : null,
      bid: input.quote && Number.isFinite(input.quote.bid) ? input.quote.bid : null,
      brokerSymbol: input.quote?.sourcePrice?.mappedSymbol ?? null,
      cooldownUntil: state.cooldownUntil && state.cooldownUntil > now.getTime() ? new Date(state.cooldownUntil).toISOString() : null,
      costPct: selected?.costPct ?? null,
      decision,
      feedStatus: input.quote?.feedType ?? 'ERROR',
      lastPriceUpdate: input.quote?.lastPriceUpdate ?? null,
      moveRatio: selected?.moveRatio ?? null,
      nextAction: decision === 'VIABLE' ? 'PAPER_TRADE_READY' : decision === 'TEMPORARILY_REJECTED' ? 'WAIT_COOLDOWN' : 'SCAN_NEXT_INSTRUMENT',
      nextCheckAt: state.cooldownUntil && state.cooldownUntil > now.getTime() ? new Date(state.cooldownUntil).toISOString() : nextCheckAt,
      observedMoveBps: round(observedMoveBps, 4),
      reason,
      requiredMoveBps: selected?.requiredMoveBps ?? null,
      score,
      selectedTarget: selected,
      session: currentSession(now),
      spreadBps: input.quote && Number.isFinite(input.quote.spreadBps) ? input.quote.spreadBps : null,
      spreadPct: selected?.spreadPct ?? null,
      symbol: input.symbol,
      targetCandidate: selected?.targetNetUsd ?? null,
    } satisfies MarketOpportunityRow,
  }
}

export async function scanMarketOpportunities(input: {
  config?: MarketOpportunityScannerConfig
  now?: Date
  symbols?: string[]
} = {}): Promise<MarketOpportunityScannerStatus> {
  const config = input.config ?? marketOpportunityScannerConfig
  const now = input.now ?? new Date()
  const symbols = input.symbols ?? marketScannerSymbolPriority
  const rows: MarketOpportunityRow[] = []
  for (const symbol of symbols) {
    let quote: CfdQuote | null = null
    try {
      quote = await getCfdQuote(symbol)
    } catch {
      quote = null
    }
    rows.push(evaluateMarketOpportunity({ config, now, quote, symbol }).row)
  }
  rows.sort((a, b) => b.score - a.score)
  const selected = rows.find((row) => row.decision === 'VIABLE') ?? null
  const cooldowns = rows
    .filter((row) => row.cooldownUntil)
    .map((row) => ({ cooldownUntil: row.cooldownUntil!, reason: row.reason, symbol: row.symbol }))
  const safety = getSafetyConfig()
  const safetyBlocked = !safety.paperOnly || safety.realTradingAllowed || safety.brokerExecutionEnabled || hasRealTradingViolation()
  const agentState: MarketOpportunityAgentState = safetyBlocked
    ? 'NO_EDGE_AVAILABLE'
    : selected
      ? 'PAPER_TRADE_READY'
      : rows.every((row) => row.decision === 'TEMPORARILY_REJECTED')
        ? 'NO_EDGE_AVAILABLE'
        : rows.some((row) => row.decision === 'FEED_INVALID')
          ? 'SCANNING_OPPORTUNITIES'
          : rows.some((row) => row.decision === 'MARKET_TOO_EXPENSIVE')
            ? 'MARKET_TOO_EXPENSIVE'
            : rows.some((row) => row.decision === 'INSUFFICIENT_VOLATILITY')
              ? 'INSUFFICIENT_VOLATILITY'
              : 'SCANNING_OPPORTUNITIES'
  return {
    activeEvaluationWindowMinutes: config.activeEvaluationWindowMinutes,
    agentState,
    baseSymbol: marketScannerBaseSymbol,
    config,
    cooldowns,
    generatedAt: now.toISOString(),
    previousTarget: 0.1,
    reason: selected
      ? `${selected.symbol} tiene score ${selected.score} y target $${selected.targetCandidate?.toFixed(2)} viable.`
      : 'No hay instrumento con score >= 75 y target/costo/movimiento validos.',
    recommendedSymbol: selected?.symbol ?? null,
    recommendedTarget: selected?.targetCandidate ?? null,
    rows,
    safety: {
      brokerExecutionEnabled: false,
      paperOnly: true,
      realTradingAllowed: false,
    },
    selected,
    symbolPriority: symbols,
  }
}

export function buildV3DiagnosticFromScanner(scanner: MarketOpportunityScannerStatus): V3DiagnosticStatus {
  const base = scanner.rows.find((row) => row.symbol === scanner.baseSymbol)
  const missing: string[] = []
  if (!base || base.decision === 'FEED_INVALID') missing.push(`Feed bid/ask valido y reciente para ${scanner.baseSymbol}.`)
  if (base?.spreadPct !== null && base?.spreadPct !== undefined && base.spreadPct > scanner.config.maxSpreadPctOfTarget) missing.push(`Spread <= ${scanner.config.maxSpreadPctOfTarget}% del target.`)
  if (base?.costPct !== null && base?.costPct !== undefined && base.costPct > scanner.config.maxCostPctOfTarget) missing.push(`Costo total <= ${scanner.config.maxCostPctOfTarget}% del target.`)
  if (base?.moveRatio !== null && base?.moveRatio !== undefined && base.moveRatio < scanner.config.minObservedMoveRatio) missing.push('Movimiento observado >= 50% del requerido.')
  const primaryProblem: V3DiagnosticStatus['primaryProblem'] = !base || base.decision === 'FEED_INVALID'
    ? 'FEED'
    : base.decision === 'MARKET_TOO_EXPENSIVE' || (base.decision === 'TEMPORARILY_REJECTED' && base.reason.includes('MARKET_TOO_EXPENSIVE'))
      ? (base.spreadPct ?? 0) > scanner.config.maxSpreadPctOfTarget ? 'SPREAD' : 'COST'
      : base.decision === 'INSUFFICIENT_VOLATILITY' || (base.decision === 'TEMPORARILY_REJECTED' && base.reason.includes('INSUFFICIENT_VOLATILITY'))
        ? 'VOLATILITY'
        : base.targetCandidate !== 0.1
          ? 'TARGET'
          : 'NONE'
  return {
    action: scanner.selected
      ? `Scanner encontro alternativa: ${scanner.selected.symbol} con target $${scanner.selected.targetCandidate?.toFixed(2)}. No ejecuta sin gate paper.`
      : 'Seguir escaneando instrumentos; si todos fallan, mantener NO_EDGE_AVAILABLE.',
    currentSymbol: scanner.baseSymbol,
    currentTarget: 0.1,
    explanation: base
      ? `${scanner.baseSymbol} esta ${base.decision}: ${base.reason}`
      : `${scanner.baseSymbol} no pudo evaluarse en el scanner actual.`,
    missing,
    primaryProblem,
    scannerState: scanner.agentState,
    selectedAlternative: scanner.selected?.symbol ?? null,
    selectedAlternativeTarget: scanner.selected?.targetCandidate ?? null,
  }
}
