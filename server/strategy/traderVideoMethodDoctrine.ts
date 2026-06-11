import { NEW_YORK_TIMEZONE, newYorkMinutes } from './tradingTimezone.js'
import type { TraderVideoReplicationStatus } from './traderVideoReplicationMode.js'

export type TraderVideoDoctrineStepId =
  | 'REAL_SP_FUTURES_DATA'
  | 'M30_SESSION_AND_PIVOT_MARKS'
  | 'SWITCH_TO_M1_BEFORE_OPEN'
  | 'OPENING_RANGE_15M'
  | 'WRONG_SIDED_TRADERS'
  | 'WEAK_COUNTERMOVE'
  | 'THREE_POINT_TRENDLINE'
  | 'TRENDLINE_BREAK_AND_FAILED_RETEST'
  | 'RED_GREEN_RR_BOX'
  | 'PAPER_ONLY_GATE'

export type TraderVideoDoctrineStep = {
  acceptanceCriteria: string[]
  id: TraderVideoDoctrineStepId
  instruction: string
  order: number
  timeframe: 'M30' | 'M1' | 'MIXED'
  title: string
  windowNY: string
}

export type TraderVideoMethodDoctrineStatus = {
  currentFocus: string
  doctrineVersion: string
  hardRules: string[]
  learnedFrom: string[]
  methodKnowledgeScore: number
  mode: 'TRADER_VIDEO_METHOD_DOCTRINE'
  nextDoctrineStep: TraderVideoDoctrineStep | null
  steps: TraderVideoDoctrineStep[]
  timestamp: string
  timezone: 'America/New_York'
  violations: string[]
}

const steps: TraderVideoDoctrineStep[] = [
  {
    acceptanceCriteria: [
      'Solo ES/MES/SP500 futuro o equivalente no-CFD con datos reales.',
      'Bid/ask o ultimo precio vivo; velas M1 reales disponibles.',
      'No usar CFD como simbolo operativo del metodo.',
    ],
    id: 'REAL_SP_FUTURES_DATA',
    instruction: 'Preparar mesa unica de S&P futures/no-CFD. La ejecucion sigue siendo paper.',
    order: 1,
    timeframe: 'MIXED',
    title: 'Datos reales S&P futures',
    windowNY: 'Antes de cualquier lectura',
  },
  {
    acceptanceCriteria: [
      'Marcar high/low de sesion cash 09:30-16:00 NY.',
      'Marcar high/low overnight 16:00-09:30 NY.',
      'Marcar pivotes M30 dramaticos: subida fuerte que falla o caida fuerte que rebota.',
      'No elegir velas M30 aleatorias; solo movimientos transcendentales.',
    ],
    id: 'M30_SESSION_AND_PIVOT_MARKS',
    instruction: 'En M30, estudiar el dia anterior y la noche actual para ubicar zonas donde hubo reaccion fuerte.',
    order: 2,
    timeframe: 'M30',
    title: 'Marcas M30 de sesion y pivotes',
    windowNY: 'Antes de 09:30 NY',
  },
  {
    acceptanceCriteria: [
      'Cambiar a M1 antes de la apertura cash.',
      'Las marcas M30 quedan dibujadas sobre la grafica M1.',
      'No decidir entrada en M30.',
    ],
    id: 'SWITCH_TO_M1_BEFORE_OPEN',
    instruction: 'La ejecucion y lectura fina se hacen en M1; M30 solo prepara el mapa.',
    order: 3,
    timeframe: 'M1',
    title: 'Cambiar a M1 antes de abrir',
    windowNY: 'Antes de 09:30 NY',
  },
  {
    acceptanceCriteria: [
      'Dibujar linea vertical en 09:30 NY.',
      'Esperar cierre de 09:45 NY.',
      'Marcar high y low de los primeros 15 minutos.',
      'No operar dentro de esos primeros 15 minutos.',
    ],
    id: 'OPENING_RANGE_15M',
    instruction: 'Observar la primera caja 09:30-09:45 y marcar ORH/ORL.',
    order: 4,
    timeframe: 'M1',
    title: 'Opening range 09:30-09:45',
    windowNY: '09:30-09:45 NY',
  },
  {
    acceptanceCriteria: [
      'Si rompe ORH y sostiene arriba, no shortear contra institucional.',
      'Si rompe ORH y falla o vuelve dentro, compradores atrapados.',
      'Si rompe ORL y sostiene abajo, no comprar contra institucional.',
      'Si rompe ORL y falla o vuelve dentro, vendedores atrapados.',
    ],
    id: 'WRONG_SIDED_TRADERS',
    instruction: 'Determinar quien quedo mal jugado contra ORH/ORL o marca previa relevante.',
    order: 5,
    timeframe: 'M1',
    title: 'Detectar compradores/vendedores atrapados',
    windowNY: 'Despues de 09:45 NY',
  },
  {
    acceptanceCriteria: [
      'El contramovimiento debe ser debil: solapamiento, poco avance, subidas/bajadas constantes.',
      'Debe existir presion previa o movimiento institucional contrario.',
      'No dibujar trendline si aun no hay lado atrapado.',
    ],
    id: 'WEAK_COUNTERMOVE',
    instruction: 'Leer la naturaleza del movimiento contrario y confirmar que es debil.',
    order: 6,
    timeframe: 'M1',
    title: 'Contramovimiento debil',
    windowNY: '09:45-16:00 NY',
  },
  {
    acceptanceCriteria: [
      'Trendline de tres puntos limpios sobre el pullback debil.',
      'Para short: linea alcista del pullback comprador debil.',
      'Para long: linea bajista del pullback vendedor debil.',
      'No usar lineas de dos puntos ni lineas dibujadas antes de tiempo.',
    ],
    id: 'THREE_POINT_TRENDLINE',
    instruction: 'Dibujar trendline solo cuando hay tres pivotes claros del lado debil.',
    order: 7,
    timeframe: 'M1',
    title: 'Trendline de tres puntos',
    windowNY: '09:45-16:00 NY',
  },
  {
    acceptanceCriteria: [
      'Esperar ruptura de la trendline.',
      'Esperar intento de volver a entrar/reclamar la linea.',
      'Entrar solo si ese retest falla.',
      'No perseguir velas sin retest fallido.',
    ],
    id: 'TRENDLINE_BREAK_AND_FAILED_RETEST',
    instruction: 'La entrada nace del fallo de recuperacion despues de romper la trendline.',
    order: 8,
    timeframe: 'M1',
    title: 'Ruptura y retest fallido',
    windowNY: '09:45-16:00 NY',
  },
  {
    acceptanceCriteria: [
      'Stop tecnico detras del maximo/minimo invalidante.',
      'Objetivo estructural razonable.',
      'Relacion riesgo/beneficio minima 1:2.',
      'Costos no pueden comerse el target.',
    ],
    id: 'RED_GREEN_RR_BOX',
    instruction: 'Construir caja roja/verde antes de abrir; si no da 1:2, no hay trade.',
    order: 9,
    timeframe: 'M1',
    title: 'Stop/objetivo con minimo 1:2',
    windowNY: '09:45-16:00 NY',
  },
  {
    acceptanceCriteria: [
      'Solo paper/demo.',
      'Una posicion maxima.',
      'realTradingAllowed=false.',
      'brokerExecutionEnabled=false.',
      'No order_send.',
      'No abrir despues de 16:00 NY.',
    ],
    id: 'PAPER_ONLY_GATE',
    instruction: 'La compuerta final conserva safety y simula con base paper.',
    order: 10,
    timeframe: 'MIXED',
    title: 'Compuerta paper segura',
    windowNY: '09:45-16:00 NY',
  },
]

function completedStepIds(status: TraderVideoReplicationStatus) {
  const completed = new Set<TraderVideoDoctrineStepId>()
  if (status.symbol && !/\.(cfd|cash)$/i.test(status.symbol)) completed.add('REAL_SP_FUTURES_DATA')
  if (status.premarketLevels.state === 'MARKING_PREMARKET_LEVELS') completed.add('M30_SESSION_AND_PIVOT_MARKS')
  if (status.openingRange.state !== 'WAITING_FOR_MARKET_OPEN') completed.add('SWITCH_TO_M1_BEFORE_OPEN')
  if (status.openingRange.state === 'OPENING_RANGE_COMPLETED') completed.add('OPENING_RANGE_15M')
  if (status.wrongSidedTrader?.trappedSide === 'BUYERS' || status.wrongSidedTrader?.trappedSide === 'SELLERS') {
    completed.add('WRONG_SIDED_TRADERS')
  }
  if ((status.weakCountermoveTrendline?.weakCountermoveScore ?? 0) >= 55) completed.add('WEAK_COUNTERMOVE')
  if ((status.trendlineFailure?.trendline?.anchorCount ?? 0) >= 3) completed.add('THREE_POINT_TRENDLINE')
  if (status.trendlineFailure?.state === 'RECOVERY_ATTEMPT_FAILED') completed.add('TRENDLINE_BREAK_AND_FAILED_RETEST')
  if ((status.redGreenRiskBox?.riskReward.riskRewardRatio ?? 0) >= 2 && status.redGreenRiskBox?.riskReward.decision === 'APPROVED') {
    completed.add('RED_GREEN_RR_BOX')
  }
  if (status.finalDecision === 'READY_FOR_PAPER_ENTRY' || status.canPaperTrade) completed.add('PAPER_ONLY_GATE')
  return completed
}

export function buildTraderVideoMethodDoctrine(input: {
  now?: Date
  status: TraderVideoReplicationStatus
}): TraderVideoMethodDoctrineStatus {
  const now = input.now ?? new Date()
  const minutes = newYorkMinutes(now)
  const completed = completedStepIds(input.status)
  const nextDoctrineStep = steps.find((step) => !completed.has(step.id)) ?? null
  const violations: string[] = []
  if (input.status.symbol && /\.(cfd|cash)$/i.test(input.status.symbol)) violations.push('El metodo del video no debe operar CFD.')
  if (minutes >= 16 * 60) violations.push('Fuera de ventana: no abrir despues de 16:00 NY.')
  if ((input.status.redGreenRiskBox?.riskReward.riskRewardRatio ?? 0) > 0 && (input.status.redGreenRiskBox?.riskReward.riskRewardRatio ?? 0) < 2) {
    violations.push('R/R menor a 1:2.')
  }
  const methodKnowledgeScore = Math.round((completed.size / steps.length) * 100)
  return {
    currentFocus: nextDoctrineStep
      ? `${nextDoctrineStep.order}. ${nextDoctrineStep.title}: ${nextDoctrineStep.instruction}`
      : 'Metodo completo; solo falta compuerta paper/safety si aun no abrio.',
    doctrineVersion: 'VIDEO_METHOD_USER_DOCTRINE_2026-06-10',
    hardRules: [
      'Solo S&P futures/no-CFD: ES/MES/SP500 equivalente del broker.',
      'Toda hora operativa se lee en New York / ET.',
      'Preparar mapa M30 con cash 09:30-16:00 y overnight 16:00-09:30.',
      'La entrada se decide en M1 despues de 09:45 NY.',
      'Trendline solo despues de detectar traders atrapados y contramovimiento debil.',
      'Trendline valida requiere tres puntos limpios.',
      'Entrada solo con ruptura de trendline y retest fallido.',
      'Risk/reward minimo 1:2.',
      'No abrir despues de 16:00 NY.',
      'Solo paper/demo: real=false, broker=false, no order_send.',
    ],
    learnedFrom: [
      'Video del trader: marcar niveles, esperar reaccion inicial y operar fallo de recuperacion.',
      'Instrucciones del usuario: M30 solo para marcas de sesion/pivotes dramaticos.',
      'Instrucciones del usuario: opening range 09:30-09:45 NY en M1.',
      'Instrucciones del usuario: detectar quien quedo mal jugado antes de trendline.',
      'Instrucciones del usuario: trendline de tres puntos, break, retest fallido, R/R minimo 1:2.',
    ],
    methodKnowledgeScore,
    mode: 'TRADER_VIDEO_METHOD_DOCTRINE',
    nextDoctrineStep,
    steps,
    timestamp: now.toISOString(),
    timezone: NEW_YORK_TIMEZONE,
    violations,
  }
}
