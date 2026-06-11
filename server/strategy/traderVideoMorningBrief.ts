import {
  colombiaClockTime,
  NEW_YORK_TIMEZONE,
  newYorkClockTime,
  newYorkDay,
  newYorkMinutes,
  newYorkWeekday,
  NY_CASH_OPEN,
  NY_FIRST_15_WINDOW,
  NY_MAIN_WINDOW,
  NY_PREMARKET_LEVELS_WINDOW,
} from './tradingTimezone.js'

export type TraderVideoMorningPhase =
  | 'WEEKEND_CLOSED'
  | 'BEFORE_PRE_MARKET_REVIEW'
  | 'PRE_MARKET_M30_MARKING'
  | 'OPENING_RANGE_BUILDING'
  | 'MAIN_METHOD_WINDOW'
  | 'AFTER_CASH_CLOSE'

export type TraderVideoMorningBriefStatus = {
  canOpenPaperByTime: boolean
  colombiaClock: string
  currentInstruction: string
  currentTimeframe: 'M30' | 'M1' | 'NONE'
  methodWindowNY: {
    cashOpen: string
    first15: string
    main: string
    preMarketLevels: string
  }
  mode: 'TRADER_VIDEO_MORNING_BRIEF'
  nextMilestone: string
  newYorkClock: string
  newYorkSessionDate: string
  phase: TraderVideoMorningPhase
  prohibitedActions: string[]
  requiredEvidenceNow: string[]
  timestamp: string
  timezone: typeof NEW_YORK_TIMEZONE
}

function briefForPhase(phase: TraderVideoMorningPhase) {
  if (phase === 'WEEKEND_CLOSED') {
    return {
      canOpenPaperByTime: false,
      currentInstruction: 'Mercado cash cerrado por fin de semana; solo estudiar y auditar, no abrir.',
      currentTimeframe: 'NONE' as const,
      nextMilestone: 'Esperar proxima sesion cash NY para preparar marcas M30.',
      requiredEvidenceNow: ['Calendario/sesion habilitada', 'Datos reales de ES/MES disponibles'],
    }
  }
  if (phase === 'BEFORE_PRE_MARKET_REVIEW') {
    return {
      canOpenPaperByTime: false,
      currentInstruction: 'Antes de preparar marcas: validar datos reales S&P futures/no-CFD y reloj New York.',
      currentTimeframe: 'NONE' as const,
      nextMilestone: `A las ${NY_PREMARKET_LEVELS_WINDOW.split('-')[0]} NY empezar marcas M30.`,
      requiredEvidenceNow: ['Feed real ES/MES/SP500', 'Bid/ask o ultimo precio vivo', 'Velas M1/M30 disponibles', 'Reloj NY claro'],
    }
  }
  if (phase === 'PRE_MARKET_M30_MARKING') {
    return {
      canOpenPaperByTime: false,
      currentInstruction: 'Marcar en M30: cash previo high/low, overnight high/low y pivotes dramaticos de rechazo/rebote.',
      currentTimeframe: 'M30' as const,
      nextMilestone: `A las ${NY_CASH_OPEN} NY cambiar a M1 y dibujar linea vertical de apertura.`,
      requiredEvidenceNow: [
        'High/low cash 09:30-16:00 del dia anterior',
        'High/low overnight 16:00-09:30 actual',
        'Pivotes M30 dramaticos, no velas aleatorias',
        'Las marcas deben quedar visibles sobre la futura grafica M1',
      ],
    }
  }
  if (phase === 'OPENING_RANGE_BUILDING') {
    return {
      canOpenPaperByTime: false,
      currentInstruction: 'Observar M1 sin operar: construir opening range 09:30-09:45 y marcar ORH/ORL.',
      currentTimeframe: 'M1' as const,
      nextMilestone: 'A las 09:45 NY empezar lectura de aceptacion/fallo contra ORH/ORL.',
      requiredEvidenceNow: ['Linea vertical 09:30 NY', 'High de primeros 15 minutos', 'Low de primeros 15 minutos', 'No trade dentro de la caja inicial'],
    }
  }
  if (phase === 'MAIN_METHOD_WINDOW') {
    return {
      canOpenPaperByTime: true,
      currentInstruction: 'Ventana activa: buscar quien queda mal jugado, contramovimiento debil, trendline 3P, ruptura, retest fallido y R/R >= 1:2.',
      currentTimeframe: 'M1' as const,
      nextMilestone: 'No abrir despues de 16:00 NY; cerrar observacion si no aparece historia completa.',
      requiredEvidenceNow: [
        'Interaccion real con ORH/ORL o marca M30 relevante',
        'Compradores o vendedores atrapados',
        'Movimiento institucional contrario',
        'Contramovimiento debil con solapamiento y poco avance',
        'Trendline de tres puntos limpios',
        'Ruptura + retest fallido',
        'Caja roja/verde con R/R minimo 1:2',
      ],
    }
  }
  return {
    canOpenPaperByTime: false,
    currentInstruction: 'Despues de 16:00 NY no se abren trades del metodo; solo revisar journal y preparar aprendizaje.',
    currentTimeframe: 'NONE' as const,
    nextMilestone: 'Esperar la siguiente sesion para repetir preparacion M30 y opening range.',
    requiredEvidenceNow: ['Cerrar evaluacion del dia', 'Auditar falsos positivos/negativos', 'No abrir fuera de ventana'],
  }
}

export function buildTraderVideoMorningBrief(now = new Date()): TraderVideoMorningBriefStatus {
  const weekday = newYorkWeekday(now)
  const minutes = newYorkMinutes(now)
  const phase: TraderVideoMorningPhase = weekday === 0 || weekday === 6
    ? 'WEEKEND_CLOSED'
    : minutes < 9 * 60
      ? 'BEFORE_PRE_MARKET_REVIEW'
      : minutes < 9 * 60 + 30
        ? 'PRE_MARKET_M30_MARKING'
        : minutes < 9 * 60 + 45
          ? 'OPENING_RANGE_BUILDING'
          : minutes < 16 * 60
            ? 'MAIN_METHOD_WINDOW'
            : 'AFTER_CASH_CLOSE'
  const phaseBrief = briefForPhase(phase)
  return {
    ...phaseBrief,
    phase,
    methodWindowNY: {
      cashOpen: NY_CASH_OPEN,
      first15: NY_FIRST_15_WINDOW,
      main: NY_MAIN_WINDOW,
      preMarketLevels: NY_PREMARKET_LEVELS_WINDOW,
    },
    mode: 'TRADER_VIDEO_MORNING_BRIEF',
    newYorkClock: newYorkClockTime(now),
    newYorkSessionDate: newYorkDay(now),
    colombiaClock: colombiaClockTime(now),
    prohibitedActions: [
      'No operar antes de 09:45 NY.',
      'No abrir despues de 16:00 NY.',
      'No usar CFD, forex o crypto para reemplazar ES/MES.',
      'No abrir por una vela aislada.',
      'No abrir sin trendline de tres puntos.',
      'No abrir sin R/R minimo 1:2.',
      'No saltarse paperOnly, DataGuard, RiskGuard, KillSwitch ni V4 safety veto.',
    ],
    timestamp: now.toISOString(),
    timezone: NEW_YORK_TIMEZONE,
  }
}
