import type { MarketOpportunityRow, MarketOpportunityScannerStatus } from './marketOpportunityScanner.js'
import { buildBookmapLiquidityLayer, type BookmapLiquidityLayerStatus } from './bookmapLiquidityLayer.js'
import { analyzeMovementNature, type MovementNatureResult } from './movementNatureAnalyzer.js'
import { observeOpeningRange, type OpeningRangeObserverStatus } from './openingRangeObserver.js'
import { buildPremarketLevels, type PremarketLevelBuilderStatus } from './premarketLevelBuilder.js'
import { buildRedGreenRiskBox, type RedGreenRiskBox } from './redGreenRiskBoxEngine.js'
import { buildSP500ProfessionalOpeningStatus, type SP500ProfessionalOpeningStatus } from './sp500ProfessionalOpeningEngine.js'
import type { ProfessionalOpeningBar, ProfessionalOpeningLevels } from './trappedTraderDetector.js'
import type { TrendlineFailureSetupStatus } from './trendlineFailureSetup.js'
import { analyzeTraderVideoEntry, buildTraderVideoAgentAuthority, type TraderVideoAgentAuthority, type TraderVideoAnalyticalDecision } from './traderVideoAnalyticalAgent.js'
import type { WrongSidedTraderResult } from './wrongSidedTraderDetector.js'
import { newYorkDay, newYorkMinutes, NY_CASH_OPEN, NY_FIRST_15_WINDOW, NY_MAIN_WINDOW, NY_PREMARKET_LEVELS_WINDOW } from './tradingTimezone.js'
import { analyzeWeakCountermoveTrendline, type WeakCountermoveTrendlineStatus } from './weakCountermoveTrendlineEngine.js'

export type TraderVideoReplicationState =
  | 'WAITING_FOR_MARKET_OPEN'
  | 'MARKING_PREMARKET_LEVELS'
  | 'WAITING_OPENING_RANGE_15M'
  | 'WAITING_FIRST_15_MINUTES'
  | 'OPENING_RANGE_MARKED'
  | 'OPENING_RANGE_COMPLETED'
  | 'WATCHING_LEVEL_REACTION'
  | 'TESTING_OPENING_RANGE_HIGH'
  | 'TESTING_OPENING_RANGE_LOW'
  | 'BREAKOUT_ACCEPTED'
  | 'BREAKOUT_FAILED'
  | 'BUYERS_TRAPPED_DETECTED'
  | 'SELLERS_TRAPPED_DETECTED'
  | 'BUYERS_TRAPPED'
  | 'SELLERS_TRAPPED'
  | 'ANALYZING_MOVEMENT_NATURE'
  | 'WEAK_COUNTERMOVE_DETECTED'
  | 'COUNTERMOVE_TRENDLINE_DRAWN'
  | 'TRENDLINE_BROKEN'
  | 'RETEST_FAILED'
  | 'BLOCKED_TRENDLINE_RECLAIM_NOT_FAILED'
  | 'TRENDLINE_RECOVERY_FAILED'
  | 'BUILDING_RED_GREEN_BOX'
  | 'READY_FOR_PAPER_SHORT'
  | 'READY_FOR_PAPER_LONG'
  | 'PAPER_TRADE_OPENED'
  | 'BLOCKED_MARKET_CLOSED'
  | 'BLOCKED_NO_SP500_SYMBOL_AVAILABLE'
  | 'BLOCKED_NO_LEVEL'
  | 'BLOCKED_NO_TRAPPED_TRADERS'
  | 'BLOCKED_NO_WEAK_COUNTERMOVE'
  | 'BLOCKED_NO_TRENDLINE_BREAK'
  | 'BLOCKED_NO_RETEST_FAILURE'
  | 'BLOCKED_MOVEMENT_NATURE_NOT_CLEAR'
  | 'BLOCKED_RR_BELOW_2'
  | 'BLOCKED_BAD_RED_GREEN_RATIO'
  | 'BLOCKED_BAD_RR'
  | 'BLOCKED_COST_TOO_HIGH'
  | 'BLOCKED_NO_STRUCTURAL_TARGET'
  | 'BLOCKED_DATA'
  | 'BLOCKED_RISK'
  | 'BLOCKED_SAFETY'
  | 'BLOCKED_NON_VIDEO_MODE_ENTRY'

export type TraderVideoReplicationStatus = {
  agentAuthority: TraderVideoAgentAuthority
  bookmap: BookmapLiquidityLayerStatus
  canPaperTrade: boolean
  candidate: MarketOpportunityRow | null
  finalDecision: 'READY_FOR_PAPER_ENTRY' | 'WAIT' | 'BLOCK'
  institutionalPressure: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  mode: 'TRADER_VIDEO_REPLICATION_MODE'
  movementNature: MovementNatureResult | null
  nextAction: string
  openingRange: OpeningRangeObserverStatus
  premarketLevels: PremarketLevelBuilderStatus
  reason: string
  redGreenRiskBox: RedGreenRiskBox | null
  sp500ProfessionalOpening: SP500ProfessionalOpeningStatus
  state: TraderVideoReplicationState
  symbol: string | null
  timestamp: string
  trendlineFailure: TrendlineFailureSetupStatus | null
  weakCountermoveTrendline: WeakCountermoveTrendlineStatus | null
  wrongSidedTrader: WrongSidedTraderResult | null
  analyticalDecision: TraderVideoAnalyticalDecision
}

export const traderVideoSp500Symbols = [
  'ES',
  'MES',
  'ESM2026',
  'MESM2026',
  'ESU2026',
  'MESU2026',
  'ESZ2026',
  'MESZ2026',
  'ESH2027',
  'MESH2027',
  'SP500',
  'US500',
  'SPX500',
  'SPX',
]

function isSp500Symbol(symbol: string | null | undefined) {
  return Boolean(symbol && !/\.(cfd|cash)$/i.test(symbol) && traderVideoSp500Symbols.includes(symbol))
}

export function isTraderVideoSymbol(candidate: Pick<MarketOpportunityRow, 'symbol'> | null | undefined) {
  return isSp500Symbol(candidate?.symbol)
}

function barsAfterOpeningRange(bars: ProfessionalOpeningBar[], now: Date) {
  const today = newYorkDay(now)
  return bars.filter((bar) => newYorkDay(new Date(bar.timestamp)) === today && newYorkMinutes(new Date(bar.timestamp)) >= 9 * 60 + 45)
}

function selectSp500Candidate(input: {
  candidate?: MarketOpportunityRow | null
  officialBrokerSymbol?: string | null
  officialLastPrice?: number | null
  officialSpreadBps?: number | null
  officialSymbol?: string | null
  scanner?: MarketOpportunityScannerStatus | null
}) {
  if (isTraderVideoSymbol(input.candidate)) return input.candidate ?? null
  const scannerSp500Candidate = input.scanner?.rows.find((row) => isSp500Symbol(row.symbol)) ?? null
  if (scannerSp500Candidate) return scannerSp500Candidate
  const officialSymbol = input.officialSymbol
  if (isSp500Symbol(officialSymbol)) {
    const symbol = String(officialSymbol)
    const hasLiveLastPrice = typeof input.officialLastPrice === 'number' && Number.isFinite(input.officialLastPrice) && input.officialLastPrice > 0
    const lastPrice = hasLiveLastPrice ? Number(input.officialLastPrice) : null
    return {
      ask: lastPrice,
      bid: lastPrice,
      brokerSymbol: input.officialBrokerSymbol ?? symbol,
      cooldownUntil: null,
      costPct: null,
      decision: 'PREPARED' as const,
      feedStatus: hasLiveLastPrice ? 'BROKER_DEMO_REALTIME' : 'MARKET_CLOSED_OR_NO_LAST_PRICE',
      lastPriceUpdate: hasLiveLastPrice ? new Date().toISOString() : null,
      moveRatio: null,
      nextAction: 'EVALUAR_METODO_VIDEO',
      nextCheckAt: new Date().toISOString(),
      observedMoveBps: 0,
      reason: hasLiveLastPrice
        ? 'Simbolo oficial S&P futures/no-CFD detectado por DataReadiness; el scanner generico no controla el metodo del video.'
        : 'Simbolo oficial S&P futures/no-CFD detectado por DataReadiness; esperando mercado/precio vivo para aplicar el metodo del video.',
      requiredMoveBps: null,
      score: 100,
      selectedTarget: null,
      session: 'SP500_VIDEO_METHOD',
      spreadBps: input.officialSpreadBps ?? null,
      spreadPct: null,
      source: 'TRADER_VIDEO_REPLICATION_MODE' as const,
      symbol,
      targetCandidate: null,
    }
  }
  return input.candidate ?? null
}

function emptyOpeningRange(now: Date, bars: ProfessionalOpeningBar[], levels: PremarketLevelBuilderStatus) {
  return observeOpeningRange({
    bars,
    now,
    previousLevels: [
      levels.previousDayHigh,
      levels.previousDayLow,
      levels.previousDayClose,
      levels.overnightHigh,
      levels.overnightLow,
      levels.vwap,
    ],
  })
}

function sessionPhase(now: Date) {
  const minutes = newYorkMinutes(now)
  if (minutes < 9 * 60 + 30) return 'PRE_MARKET'
  if (minutes < 9 * 60 + 45) return 'FIRST_15_MINUTES'
  if (minutes < 16 * 60) return 'MAIN_WINDOW'
  return 'MARKET_CLOSED'
}

function candidateMid(candidate: MarketOpportunityRow | null) {
  if (!candidate) return null
  if (typeof candidate.bid === 'number' && typeof candidate.ask === 'number') return (candidate.bid + candidate.ask) / 2
  if (typeof candidate.bid === 'number') return candidate.bid
  if (typeof candidate.ask === 'number') return candidate.ask
  return null
}

function hasFreshCandidateFeed(candidate: MarketOpportunityRow | null) {
  if (!candidate) return false
  const feed = String(candidate.feedStatus ?? '').toUpperCase()
  if (feed.includes('STALE') || feed.includes('MISSING') || feed.includes('ERROR') || feed.includes('CLOSED')) return false
  if (!candidate.lastPriceUpdate) return true
  const ageMs = Date.now() - Date.parse(candidate.lastPriceUpdate)
  return Number.isFinite(ageMs) ? ageMs <= 120_000 : true
}

function buildAnalyticalDecision(input: {
  bars: ProfessionalOpeningBar[]
  now: Date
  status: Omit<TraderVideoReplicationStatus, 'agentAuthority' | 'analyticalDecision'>
}) {
  const status = input.status
  return analyzeTraderVideoEntry({
    bookmapContext: status.bookmap,
    currentPrice: candidateMid(status.candidate),
    currentTimeNY: null,
    dataQuality: {
      barsCount: input.bars.length,
      feedFresh: hasFreshCandidateFeed(status.candidate),
      hasLevels: status.premarketLevels.state !== 'BLOCKED_NO_LEVEL',
      hasTimezoneClarity: true,
      marketClosed: sessionPhase(input.now) === 'MARKET_CLOSED',
    },
    movementNature: status.movementNature,
    openingRange: status.openingRange,
    premarketLevels: status.premarketLevels,
    redGreenBox: status.redGreenRiskBox,
    sessionDate: newYorkDay(input.now),
    sessionPhase: sessionPhase(input.now),
    structuralRiskReward: status.redGreenRiskBox?.riskReward ?? null,
    symbol: status.symbol,
    testedLevel: status.weakCountermoveTrendline?.openingRangeLevel ?? null,
    trendlineFailure: status.trendlineFailure,
    weakCountermove: status.weakCountermoveTrendline,
    wrongSidedTrader: status.wrongSidedTrader,
  })
}

function modeStatus(input: {
  bars: ProfessionalOpeningBar[]
  bookmap?: Partial<BookmapLiquidityLayerStatus>
  candidate: MarketOpportunityRow | null
  now: Date
  openPaperTrade?: boolean
  safetyStatus?: {
    brokerExecutionEnabled: boolean
    killSwitchStatus: 'CLEAR' | 'TRIGGERED'
    paperOnly: boolean
    realTradingAllowed: boolean
  }
}): TraderVideoReplicationStatus {
  const now = input.now
  const premarketLevels = buildPremarketLevels({ bars: input.bars, now })
  const openingRange = emptyOpeningRange(now, input.bars, premarketLevels)
  const bookmap = buildBookmapLiquidityLayer(input.bookmap)
  const baseProfessional = buildSP500ProfessionalOpeningStatus({
    bars: input.bars,
    candidate: input.candidate,
    liquidityMap: bookmap,
    now,
    openPaperTrade: input.openPaperTrade,
    safetyStatus: input.safetyStatus,
  })
  const base = {
    bookmap,
    candidate: input.candidate,
    institutionalPressure: 'NEUTRAL' as const,
    mode: 'TRADER_VIDEO_REPLICATION_MODE' as const,
    movementNature: null,
    openingRange,
    premarketLevels,
    redGreenRiskBox: null,
    sp500ProfessionalOpening: baseProfessional,
    symbol: input.candidate?.symbol ?? null,
    timestamp: now.toISOString(),
    trendlineFailure: null,
    weakCountermoveTrendline: null,
    wrongSidedTrader: null,
  }

  function status(overrides: Partial<Omit<TraderVideoReplicationStatus, 'analyticalDecision'>> & Pick<TraderVideoReplicationStatus, 'canPaperTrade' | 'finalDecision' | 'nextAction' | 'reason' | 'state'>): TraderVideoReplicationStatus {
    const merged = { ...base, ...overrides } as Omit<TraderVideoReplicationStatus, 'agentAuthority' | 'analyticalDecision'>
    const analyticalDecision = buildAnalyticalDecision({ bars: input.bars, now, status: merged })
    const agentAuthority = buildTraderVideoAgentAuthority(analyticalDecision)
    const analyticalAllowsPaper = agentAuthority.canOpenTactically
    const adjusted = merged.finalDecision === 'READY_FOR_PAPER_ENTRY' && !analyticalAllowsPaper
      ? {
          ...merged,
          canPaperTrade: false,
          finalDecision: 'BLOCK' as const,
          nextAction: analyticalDecision.nextRequiredCondition,
          reason: analyticalDecision.humanReasoning,
        }
      : merged
    return {
      ...adjusted,
      agentAuthority,
      analyticalDecision,
    }
  }

  if (input.openPaperTrade) {
    return status({
      ...base,
      canPaperTrade: false,
      finalDecision: 'WAIT',
      nextAction: 'Gestionar trade paper abierto; no abrir otro.',
      reason: 'Ya hay paper trade abierto.',
      state: 'PAPER_TRADE_OPENED',
    })
  }

  if (input.safetyStatus && (
    input.safetyStatus.paperOnly !== true
    || input.safetyStatus.realTradingAllowed !== false
    || input.safetyStatus.brokerExecutionEnabled !== false
    || input.safetyStatus.killSwitchStatus !== 'CLEAR'
  )) {
    return status({
      ...base,
      canPaperTrade: false,
      finalDecision: 'BLOCK',
      nextAction: 'Restaurar safety antes de cualquier paper trade.',
      reason: 'Safety no esta limpio.',
      state: 'BLOCKED_SAFETY',
    })
  }

  if (!input.candidate) {
    return status({
      ...base,
      canPaperTrade: false,
      finalDecision: 'BLOCK',
      nextAction: 'Configurar simbolo S&P futures/no-CFD confiable; no sustituir por crypto/forex/CFD.',
      reason: 'No hay simbolo S&P futures/no-CFD disponible para replicar la metodologia del video.',
      state: 'BLOCKED_NO_SP500_SYMBOL_AVAILABLE',
    })
  }

  if (!isTraderVideoSymbol(input.candidate)) {
    return status({
      ...base,
      canPaperTrade: false,
      finalDecision: 'BLOCK',
      nextAction: 'Ignorar candidato generico; buscar solo S&P futures/no-CFD.',
      reason: `${input.candidate.symbol} es solo diagnostico; no pertenece al universo S&P futures/no-CFD del video.`,
      state: 'BLOCKED_NON_VIDEO_MODE_ENTRY',
    })
  }

  const minutes = newYorkMinutes(now)
  if (minutes >= 16 * 60) {
    const closedSessionWeakCountermove = input.bars.length >= 20
      && openingRange.openingRangeHigh
      && openingRange.openingRangeLow
      && premarketLevels.state !== 'BLOCKED_NO_LEVEL'
      ? (() => {
          const levels: ProfessionalOpeningLevels = {
            openingRangeHigh: openingRange.openingRangeHigh,
            openingRangeLow: openingRange.openingRangeLow,
            overnightHigh: premarketLevels.overnightHigh,
            overnightLow: premarketLevels.overnightLow,
            previousDayClose: premarketLevels.previousDayClose,
            previousDayHigh: premarketLevels.previousDayHigh,
            previousDayLow: premarketLevels.previousDayLow,
            sessionHigh: Math.max(...input.bars.map((bar) => bar.high)),
            sessionLow: Math.min(...input.bars.map((bar) => bar.low)),
          }
          return analyzeWeakCountermoveTrendline({ bars: barsAfterOpeningRange(input.bars, now), levels })
        })()
      : null
    const closedMissedCount = closedSessionWeakCountermove?.missedOpportunities.length ?? 0
    return status({
      ...base,
      canPaperTrade: false,
      finalDecision: 'BLOCK',
      movementNature: closedSessionWeakCountermove?.movementNature ?? null,
      nextAction: `Esperar la proxima preparacion ${NY_PREMARKET_LEVELS_WINDOW} New York; no operar fuera de la ventana del metodo.`,
      reason: closedMissedCount > 0
        ? `La ventana del metodo ya cerro; no abrir tarde. Auditoria: ${closedMissedCount} oportunidad(es) intradia detectada(s) en trampa/trendline.`
        : `La ventana del metodo del video ya cerro: preparacion ${NY_PREMARKET_LEVELS_WINDOW}, open range ${NY_FIRST_15_WINDOW}, entradas ${NY_MAIN_WINDOW} New York.`,
      state: 'BLOCKED_MARKET_CLOSED',
      trendlineFailure: closedSessionWeakCountermove?.trendlineFailure ?? null,
      weakCountermoveTrendline: closedSessionWeakCountermove,
      wrongSidedTrader: closedSessionWeakCountermove?.wrongSidedTrader ?? null,
    })
  }

  if (openingRange.state === 'WAITING_FOR_MARKET_OPEN') {
    return status({
      ...base,
      canPaperTrade: false,
      finalDecision: 'WAIT',
      nextAction: `Entre ${NY_PREMARKET_LEVELS_WINDOW} New York construir mapa M30: cash 09:30-16:00 high/low y overnight 16:00-09:30 high/low. Apertura cash ${NY_CASH_OPEN} NY.`,
      reason: 'Esperando apertura cash; no se opera antes.',
      state: premarketLevels.state === 'BLOCKED_NO_LEVEL' ? 'BLOCKED_NO_LEVEL' : 'WAITING_FOR_MARKET_OPEN',
    })
  }

  if (openingRange.state === 'WAITING_FIRST_15_MINUTES') {
    return status({
      ...base,
      canPaperTrade: false,
      finalDecision: 'WAIT',
      nextAction: 'Observar los primeros 15 minutos sin operar.',
      reason: 'WAITING_FIRST_15_MINUTES: construyendo opening range.',
      state: 'WAITING_FIRST_15_MINUTES',
    })
  }

  if (premarketLevels.state === 'BLOCKED_NO_LEVEL') {
    return status({
      ...base,
      canPaperTrade: false,
      finalDecision: 'BLOCK',
      nextAction: 'Necesita previous day high/low/close y overnight high/low.',
      reason: 'No hay suficientes niveles importantes para construir el trade del video.',
      state: 'BLOCKED_NO_LEVEL',
    })
  }

  if (input.bars.length < 20 || !openingRange.openingRangeHigh || !openingRange.openingRangeLow) {
    return status({
      ...base,
      canPaperTrade: false,
      finalDecision: 'BLOCK',
      nextAction: 'Conectar/guardar velas 1m de premarket, dia previo y apertura.',
      reason: 'DATA_NOT_READY: faltan velas para apertura, niveles y reaccion.',
      state: 'BLOCKED_DATA',
    })
  }

  const levels: ProfessionalOpeningLevels = {
    openingRangeHigh: openingRange.openingRangeHigh,
    openingRangeLow: openingRange.openingRangeLow,
    overnightHigh: premarketLevels.overnightHigh,
    overnightLow: premarketLevels.overnightLow,
    previousDayClose: premarketLevels.previousDayClose,
    previousDayHigh: premarketLevels.previousDayHigh,
    previousDayLow: premarketLevels.previousDayLow,
    sessionHigh: Math.max(...input.bars.map((bar) => bar.high)),
    sessionLow: Math.min(...input.bars.map((bar) => bar.low)),
  }
  const reactionBars = barsAfterOpeningRange(input.bars, now)
  const weakCountermoveTrendline = analyzeWeakCountermoveTrendline({ bars: reactionBars, levels })
  const wrongSidedTrader = weakCountermoveTrendline.wrongSidedTrader
  if (!wrongSidedTrader || weakCountermoveTrendline.intendedDirection === 'NONE') {
    return status({
      ...base,
      canPaperTrade: false,
      finalDecision: weakCountermoveTrendline.state === 'BREAKOUT_ACCEPTED' ? 'WAIT' : 'BLOCK',
      nextAction: 'Esperar que el precio pruebe high/low del opening range y falle antes de trazar trendline.',
      reason: weakCountermoveTrendline.reason,
      state: weakCountermoveTrendline.state === 'OPENING_RANGE_MARKED'
        ? 'OPENING_RANGE_MARKED'
        : weakCountermoveTrendline.state === 'TESTING_OPENING_RANGE_HIGH'
          ? 'TESTING_OPENING_RANGE_HIGH'
          : weakCountermoveTrendline.state === 'TESTING_OPENING_RANGE_LOW'
            ? 'TESTING_OPENING_RANGE_LOW'
            : weakCountermoveTrendline.state === 'BREAKOUT_ACCEPTED'
              ? 'BREAKOUT_ACCEPTED'
              : 'BLOCKED_NO_TRAPPED_TRADERS',
      weakCountermoveTrendline,
      wrongSidedTrader,
    })
  }

  const side = weakCountermoveTrendline.intendedDirection
  const movementNature = weakCountermoveTrendline.movementNature ?? analyzeMovementNature({ bars: reactionBars, intendedDirection: side })
  if (weakCountermoveTrendline.state === 'BLOCKED_NO_WEAK_COUNTERMOVE') {
    return status({
      ...base,
      canPaperTrade: false,
      finalDecision: 'BLOCK',
      institutionalPressure: movementNature.dominantPressure,
      movementNature,
      nextAction: 'Esperar movimiento contrario debil: solapamiento, poco avance y falta de continuidad.',
      reason: weakCountermoveTrendline.reason,
      state: 'BLOCKED_NO_WEAK_COUNTERMOVE',
      weakCountermoveTrendline,
      wrongSidedTrader,
    })
  }

  const entryPrice = side === 'SHORT' ? input.candidate.bid : input.candidate.ask
  if (typeof entryPrice !== 'number' || !Number.isFinite(entryPrice)) {
    return status({
      ...base,
      canPaperTrade: false,
      finalDecision: 'BLOCK',
      institutionalPressure: movementNature.dominantPressure,
      movementNature,
      nextAction: 'Esperar bid/ask valido para construir la zona roja y verde.',
      reason: 'Bid/ask invalido; no se puede calcular entrada, stop tecnico ni target estructural.',
      state: 'BLOCKED_DATA',
      weakCountermoveTrendline,
      wrongSidedTrader,
    })
  }
  const trendlineFailure = weakCountermoveTrendline.trendlineFailure
  if (!trendlineFailure) {
    return status({
      ...base,
      canPaperTrade: false,
      finalDecision: 'BLOCK',
      institutionalPressure: movementNature.dominantPressure,
      movementNature,
      nextAction: 'Esperar tres puntos limpios para trazar la linea del contramovimiento debil.',
      reason: weakCountermoveTrendline.reason,
      state: 'BLOCKED_NO_TRENDLINE_BREAK',
      weakCountermoveTrendline,
      wrongSidedTrader,
    })
  }
  if (!trendlineFailure.canUseForEntry) {
    const blockedState = weakCountermoveTrendline.state === 'BLOCKED_NO_RETEST_FAILURE' || weakCountermoveTrendline.state === 'TRENDLINE_BROKEN'
      ? 'BLOCKED_NO_RETEST_FAILURE'
      : 'BLOCKED_NO_TRENDLINE_BREAK'
    return status({
      ...base,
      canPaperTrade: false,
      finalDecision: 'BLOCK',
      institutionalPressure: movementNature.dominantPressure,
      movementNature,
      nextAction: blockedState === 'BLOCKED_NO_RETEST_FAILURE'
        ? 'Esperar que intente recuperar la trendline y falle.'
        : 'Esperar ruptura real de la trendline del contramovimiento debil.',
      reason: weakCountermoveTrendline.reason,
      state: blockedState,
      trendlineFailure,
      weakCountermoveTrendline,
      wrongSidedTrader,
    })
  }

  const redGreenRiskBox = buildRedGreenRiskBox({
    entryPrice,
    levels,
    side,
    spreadBps: input.candidate.spreadBps,
    trap: wrongSidedTrader,
  })
  if (redGreenRiskBox.state !== 'VALID_RED_GREEN_BOX') {
    return status({
      ...base,
      canPaperTrade: false,
      finalDecision: 'BLOCK',
      institutionalPressure: movementNature.dominantPressure,
      movementNature,
      nextAction: 'Esperar zona verde que justifique claramente la zona roja.',
      reason: redGreenRiskBox.riskReward.reason,
      redGreenRiskBox,
      state: redGreenRiskBox.state === 'BLOCKED_BAD_RR' ? 'BLOCKED_RR_BELOW_2' : redGreenRiskBox.state,
      trendlineFailure,
      weakCountermoveTrendline,
      wrongSidedTrader,
    })
  }

  return status({
    ...base,
    canPaperTrade: true,
    finalDecision: 'READY_FOR_PAPER_ENTRY',
    institutionalPressure: movementNature.dominantPressure,
    movementNature,
    nextAction: 'Abrir solo paper con stop tecnico, target estructural y journal del video.',
    reason: `${wrongSidedTrader.wrongSidedState}; ${movementNature.explanation}; ${redGreenRiskBox.riskReward.reason}`,
    redGreenRiskBox,
    state: side === 'SHORT' ? 'READY_FOR_PAPER_SHORT' : 'READY_FOR_PAPER_LONG',
    trendlineFailure,
    weakCountermoveTrendline,
    wrongSidedTrader,
  })
}

export function buildTraderVideoReplicationMode(input: {
  bars?: ProfessionalOpeningBar[]
  bookmap?: Partial<BookmapLiquidityLayerStatus>
  candidate?: MarketOpportunityRow | null
  now?: Date
  officialBrokerSymbol?: string | null
  officialLastPrice?: number | null
  officialSpreadBps?: number | null
  officialSymbol?: string | null
  openPaperTrade?: boolean
  safetyStatus?: {
    brokerExecutionEnabled: boolean
    killSwitchStatus: 'CLEAR' | 'TRIGGERED'
    paperOnly: boolean
    realTradingAllowed: boolean
  }
  scanner?: MarketOpportunityScannerStatus | null
} = {}): TraderVideoReplicationStatus {
  const candidate = selectSp500Candidate({
    candidate: input.candidate,
    officialBrokerSymbol: input.officialBrokerSymbol,
    officialLastPrice: input.officialLastPrice,
    officialSpreadBps: input.officialSpreadBps,
    officialSymbol: input.officialSymbol,
    scanner: input.scanner ?? null,
  })
  return modeStatus({
    bars: input.bars ?? [],
    bookmap: input.bookmap,
    candidate,
    now: input.now ?? new Date(),
    openPaperTrade: input.openPaperTrade,
    safetyStatus: input.safetyStatus,
  })
}

export function canTraderVideoModeOpen(status: TraderVideoReplicationStatus) {
  return status.mode === 'TRADER_VIDEO_REPLICATION_MODE'
    && status.finalDecision === 'READY_FOR_PAPER_ENTRY'
    && status.agentAuthority?.canOpenTactically === true
    && (status.state === 'READY_FOR_PAPER_SHORT' || status.state === 'READY_FOR_PAPER_LONG')
    && status.canPaperTrade
}
