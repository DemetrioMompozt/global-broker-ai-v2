import type { MarketOpportunityRow } from './marketOpportunityScanner.js'
import { buildLiquidityMapContext, type LiquidityMapContext } from './liquidityMapAdapter.js'
import { analyzeMovementNature, type MovementNatureResult } from './movementNatureAnalyzer.js'
import { evaluateStructuralRiskReward, type StructuralRiskRewardDecision } from './structuralRiskRewardEngine.js'
import { newYorkDay, newYorkMinutes, NY_CASH_OPEN, NY_FIRST_15_WINDOW } from './tradingTimezone.js'
import {
  detectTrappedTraders,
  type ProfessionalOpeningBar,
  type ProfessionalOpeningLevels,
  type TrappedTraderResult,
} from './trappedTraderDetector.js'

export type SP500ProfessionalOpeningState =
  | 'WAITING_FOR_MARKET_OPEN'
  | 'WAITING_FOR_OPENING_RANGE'
  | 'MARKING_LEVELS'
  | 'OPENING_RANGE_COMPLETED'
  | 'WATCHING_LEVEL_REACTION'
  | 'BULL_TRAP_DETECTED'
  | 'BEAR_TRAP_DETECTED'
  | 'WAITING_FOR_PULLBACK'
  | 'CONFIRMING_PRESSURE'
  | 'READY_FOR_PAPER_ENTRY'
  | 'BLOCKED_NO_TRAP'
  | 'BLOCKED_WEAK_PRESSURE'
  | 'BLOCKED_BAD_RR'
  | 'BLOCKED_COST_TOO_HIGH'
  | 'BLOCKED_DATA'
  | 'BLOCKED_RISK'
  | 'BLOCKED_SAFETY'
  | 'PAPER_TRADE_OPENED'

export type SP500ProfessionalOpeningStatus = {
  blockerCode: string | null
  canPaperTrade: boolean
  candidateSymbol: string | null
  direction: 'LONG' | 'SHORT' | 'NONE'
  finalDecision: 'READY_FOR_PAPER_ENTRY' | 'WAIT' | 'BLOCK'
  keyLevels: ProfessionalOpeningLevels & {
    openingPrice: number | null
    vwap: number | null
  }
  liquidityMap: LiquidityMapContext
  movementNature: MovementNatureResult | null
  nextAction: string
  openingRange: {
    completed: boolean
    direction: 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN'
    durationMinutes: 15
    high: number | null
    low: number | null
    size: number | null
    volatilityBps: number | null
  }
  reason: string
  riskReward: StructuralRiskRewardDecision | null
  setupName: 'SP500_PROFESSIONAL_OPENING_SETUP'
  state: SP500ProfessionalOpeningState
  symbolScope: string[]
  timestamp: string
  trap: TrappedTraderResult | null
}

const indexSymbols = new Set([
  'ES',
  'ESM2026',
  'MES',
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
])

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function requiresSP500ProfessionalOpening(candidate: Pick<MarketOpportunityRow, 'symbol'> | null | undefined) {
  return Boolean(candidate && !/\.(cfd|cash)$/i.test(candidate.symbol) && indexSymbols.has(candidate.symbol))
}

function initialStatus(now: Date, candidate: MarketOpportunityRow | null): SP500ProfessionalOpeningStatus {
  return {
    blockerCode: null,
    canPaperTrade: false,
    candidateSymbol: candidate?.symbol ?? null,
    direction: 'NONE',
    finalDecision: 'WAIT',
    keyLevels: {
      openingPrice: null,
      openingRangeHigh: null,
      openingRangeLow: null,
      overnightHigh: null,
      overnightLow: null,
      previousDayClose: null,
      previousDayHigh: null,
      previousDayLow: null,
      sessionHigh: null,
      sessionLow: null,
      vwap: null,
    },
    liquidityMap: buildLiquidityMapContext(),
    movementNature: null,
    nextAction: 'Esperar apertura cash de Estados Unidos y los primeros 15 minutos.',
    openingRange: {
      completed: false,
      direction: 'UNKNOWN',
      durationMinutes: 15,
      high: null,
      low: null,
      size: null,
      volatilityBps: null,
    },
    reason: 'Esperando lectura profesional de apertura.',
    riskReward: null,
    setupName: 'SP500_PROFESSIONAL_OPENING_SETUP',
    state: 'WAITING_FOR_MARKET_OPEN',
    symbolScope: Array.from(indexSymbols).sort(),
    timestamp: now.toISOString(),
    trap: null,
  }
}

function deriveLevels(bars: ProfessionalOpeningBar[], now: Date): SP500ProfessionalOpeningStatus['keyLevels'] {
  const today = newYorkDay(now)
  const previousBars = bars.filter((bar) => newYorkDay(new Date(bar.timestamp)) < today)
  const todayBars = bars.filter((bar) => newYorkDay(new Date(bar.timestamp)) === today)
  const beforeOpen = todayBars.filter((bar) => newYorkMinutes(new Date(bar.timestamp)) < 9 * 60 + 30)
  const openingBars = todayBars.filter((bar) => {
    const minutes = newYorkMinutes(new Date(bar.timestamp))
    return minutes >= 9 * 60 + 30 && minutes < 9 * 60 + 45
  })
  const high = (items: ProfessionalOpeningBar[]) => items.length ? Math.max(...items.map((bar) => bar.high)) : null
  const low = (items: ProfessionalOpeningBar[]) => items.length ? Math.min(...items.map((bar) => bar.low)) : null
  const close = previousBars.at(-1)?.close ?? null
  const vwapSource = todayBars.length ? todayBars : bars
  const volumeSum = vwapSource.reduce((sum, bar) => sum + Number(bar.volume ?? 1), 0)
  const vwap = volumeSum > 0
    ? vwapSource.reduce((sum, bar) => sum + ((bar.high + bar.low + bar.close) / 3) * Number(bar.volume ?? 1), 0) / volumeSum
    : null
  return {
    openingPrice: openingBars[0]?.open ?? todayBars.find((bar) => newYorkMinutes(new Date(bar.timestamp)) >= 9 * 60 + 30)?.open ?? null,
    openingRangeHigh: high(openingBars),
    openingRangeLow: low(openingBars),
    overnightHigh: high(beforeOpen),
    overnightLow: low(beforeOpen),
    previousDayClose: close,
    previousDayHigh: high(previousBars),
    previousDayLow: low(previousBars),
    sessionHigh: high(todayBars),
    sessionLow: low(todayBars),
    vwap,
  }
}

function openingRangeStatus(levels: SP500ProfessionalOpeningStatus['keyLevels']): SP500ProfessionalOpeningStatus['openingRange'] {
  const high = levels.openingRangeHigh
  const low = levels.openingRangeLow
  const size = finite(high) && finite(low) ? high - low : null
  const volatilityBps = finite(size) && finite(levels.openingPrice) && levels.openingPrice > 0
    ? size / levels.openingPrice * 10_000
    : null
  const direction = finite(levels.openingPrice) && finite(high) && finite(low)
    ? high - levels.openingPrice > levels.openingPrice - low
      ? 'UP'
      : levels.openingPrice - low > high - levels.openingPrice
        ? 'DOWN'
        : 'FLAT'
    : 'UNKNOWN'
  return {
    completed: finite(high) && finite(low),
    direction,
    durationMinutes: 15,
    high,
    low,
    size: finite(size) ? round(size, 4) : null,
    volatilityBps: finite(volatilityBps) ? round(volatilityBps, 2) : null,
  }
}

function barsAfterOpeningRange(bars: ProfessionalOpeningBar[], now: Date) {
  const today = newYorkDay(now)
  return bars.filter((bar) => newYorkDay(new Date(bar.timestamp)) === today && newYorkMinutes(new Date(bar.timestamp)) >= 9 * 60 + 45)
}

function decidePressurePass(direction: 'LONG' | 'SHORT', movement: MovementNatureResult) {
  return direction === 'SHORT'
    ? movement.dominantPressure === 'BEARISH' && movement.institutionalPressureScore >= 65
    : movement.dominantPressure === 'BULLISH' && movement.institutionalPressureScore >= 65
}

export function buildSP500ProfessionalOpeningStatus(input: {
  bars?: ProfessionalOpeningBar[]
  candidate?: MarketOpportunityRow | null
  dataGuardApproved?: boolean
  liquidityMap?: Partial<LiquidityMapContext>
  now?: Date
  openPaperTrade?: boolean
  riskGuardApproved?: boolean
  safetyStatus?: {
    brokerExecutionEnabled: boolean
    killSwitchStatus: 'CLEAR' | 'TRIGGERED'
    paperOnly: boolean
    realTradingAllowed: boolean
  }
} = {}): SP500ProfessionalOpeningStatus {
  const now = input.now ?? new Date()
  const candidate = input.candidate ?? null
  const base = initialStatus(now, candidate)
  base.liquidityMap = buildLiquidityMapContext(input.liquidityMap)

  if (input.openPaperTrade) {
    return {
      ...base,
      canPaperTrade: false,
      finalDecision: 'WAIT',
      nextAction: 'Gestionar el trade paper abierto; no abrir otra posicion simultanea.',
      reason: 'Ya hay trade paper abierto.',
      state: 'PAPER_TRADE_OPENED',
    }
  }

  if (input.safetyStatus && (
    input.safetyStatus.paperOnly !== true
    || input.safetyStatus.realTradingAllowed !== false
    || input.safetyStatus.brokerExecutionEnabled !== false
    || input.safetyStatus.killSwitchStatus !== 'CLEAR'
  )) {
    return {
      ...base,
      blockerCode: 'BLOCKED_SAFETY',
      finalDecision: 'BLOCK',
      nextAction: 'Restaurar safety antes de cualquier lectura operativa.',
      reason: 'Safety no esta limpio para paper/demo.',
      state: 'BLOCKED_SAFETY',
    }
  }

  if (!candidate || !requiresSP500ProfessionalOpening(candidate)) {
    return {
      ...base,
      finalDecision: 'WAIT',
      nextAction: 'Solo aplica a S&P/ES/US500 y demas indices configurados.',
      reason: 'No hay candidato de indice que requiera setup profesional de apertura.',
      state: 'WAITING_FOR_MARKET_OPEN',
    }
  }

  const minutes = newYorkMinutes(now)
  if (minutes < 9 * 60 + 30) {
    return {
      ...base,
      nextAction: `Esperar apertura cash ${NY_CASH_OPEN} New York.`,
      reason: 'Antes de la apertura: no se opera; solo se preparan niveles del dia anterior y overnight.',
      state: 'WAITING_FOR_MARKET_OPEN',
    }
  }
  if (minutes < 9 * 60 + 45) {
    return {
      ...base,
      nextAction: 'Observar los primeros 15 minutos sin abrir trades.',
      reason: `Opening range ${NY_FIRST_15_WINDOW} New York en formacion; todavia no se puede operar como en el video.`,
      state: 'WAITING_FOR_OPENING_RANGE',
    }
  }

  const bars = (input.bars ?? []).filter((bar) => [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite))
  if (bars.length < 20) {
    return {
      ...base,
      blockerCode: 'DATA_NOT_READY',
      finalDecision: 'BLOCK',
      nextAction: 'Conectar/guardar velas 1m de premarket, dia previo y apertura antes de permitir indices.',
      reason: 'No hay suficientes velas 1m para marcar niveles, opening range y trampa de traders.',
      state: 'BLOCKED_DATA',
    }
  }

  const levels = deriveLevels(bars, now)
  const openingRange = openingRangeStatus(levels)
  const withLevels = { ...base, keyLevels: levels, openingRange }
  if (!openingRange.completed || !finite(levels.openingRangeHigh) || !finite(levels.openingRangeLow)) {
    return {
      ...withLevels,
      blockerCode: 'NO_OPENING_RANGE',
      finalDecision: 'BLOCK',
      nextAction: 'Esperar velas completas del rango inicial.',
      reason: 'No hay opening range completo de 15 minutos.',
      state: 'MARKING_LEVELS',
    }
  }

  const reactionBars = barsAfterOpeningRange(bars, now)
  const trap = detectTrappedTraders({ bars: reactionBars, levels })
  if (trap.trapType === 'NONE') {
    return {
      ...withLevels,
      blockerCode: 'NO_TRAPPED_TRADERS',
      finalDecision: 'BLOCK',
      nextAction: 'Esperar ruptura fallida y traders atrapados en un nivel importante.',
      reason: trap.reason,
      state: 'BLOCKED_NO_TRAP',
      trap,
    }
  }

  const direction = trap.trapType === 'BULL_TRAP' ? 'SHORT' : 'LONG'
  const movement = analyzeMovementNature({
    bars: reactionBars,
    intendedDirection: direction,
  })
  const pressurePass = decidePressurePass(direction, movement)
  if (!pressurePass) {
    return {
      ...withLevels,
      blockerCode: 'WEAK_INSTITUTIONAL_PRESSURE',
      direction,
      finalDecision: 'BLOCK',
      movementNature: movement,
      nextAction: 'Esperar que el impulso dominante sea mas fuerte que el pullback.',
      reason: movement.explanation,
      state: 'BLOCKED_WEAK_PRESSURE',
      trap,
    }
  }

  const entryPrice = direction === 'SHORT' ? candidate.bid : candidate.ask
  if (!finite(entryPrice)) {
    return {
      ...withLevels,
      blockerCode: 'DATA_NOT_READY',
      direction,
      finalDecision: 'BLOCK',
      movementNature: movement,
      nextAction: 'Esperar bid/ask valido antes de construir rojo/verde.',
      reason: 'Bid/ask invalido para calcular entrada, stop y target estructural.',
      state: 'BLOCKED_DATA',
      trap,
    }
  }
  const riskReward = evaluateStructuralRiskReward({
    entryPrice,
    levels,
    side: direction,
    spreadBps: candidate.spreadBps,
    trap,
  })
  if (riskReward.decision === 'BLOCKED') {
    const costBlock = riskReward.blockers.some((blocker) => blocker.includes('COST'))
    return {
      ...withLevels,
      blockerCode: costBlock ? 'COST_TOO_HIGH' : 'BAD_RISK_REWARD',
      direction,
      finalDecision: 'BLOCK',
      movementNature: movement,
      nextAction: costBlock
        ? 'Esperar target estructural mas amplio o costos menores.'
        : 'Esperar setup con stop tecnico y target estructural que paguen minimo 1:2.',
      reason: riskReward.reason,
      riskReward,
      state: costBlock ? 'BLOCKED_COST_TOO_HIGH' : 'BLOCKED_BAD_RR',
      trap,
    }
  }

  if (input.dataGuardApproved === false) {
    return {
      ...withLevels,
      blockerCode: 'DATA_NOT_READY',
      direction,
      finalDecision: 'BLOCK',
      movementNature: movement,
      nextAction: 'Resolver DataGuard antes de ejecutar paper.',
      reason: 'DataGuard no aprueba el setup de indice.',
      riskReward,
      state: 'BLOCKED_DATA',
      trap,
    }
  }
  if (input.riskGuardApproved === false) {
    return {
      ...withLevels,
      blockerCode: 'BLOCKED_RISK',
      direction,
      finalDecision: 'BLOCK',
      movementNature: movement,
      nextAction: 'Resolver RiskGuard antes de ejecutar paper.',
      reason: 'RiskGuard no aprueba el setup de indice.',
      riskReward,
      state: 'BLOCKED_RISK',
      trap,
    }
  }

  return {
    ...withLevels,
    blockerCode: null,
    canPaperTrade: true,
    direction,
    finalDecision: 'READY_FOR_PAPER_ENTRY',
    movementNature: movement,
    nextAction: 'Pasar a PaperExecution con stop tecnico, target estructural y safety demo.',
    reason: `${trap.trapType} confirmado; ${movement.explanation}; ${riskReward.reason}`,
    riskReward,
    state: 'READY_FOR_PAPER_ENTRY',
    trap,
  }
}
