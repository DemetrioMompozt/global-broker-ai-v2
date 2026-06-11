import type { BookmapLiquidityLayerStatus } from './bookmapLiquidityLayer.js'
import type { MovementNatureResult } from './movementNatureAnalyzer.js'
import type { OpeningRangeObserverStatus } from './openingRangeObserver.js'
import type { PremarketLevelBuilderStatus } from './premarketLevelBuilder.js'
import type { RedGreenRiskBox } from './redGreenRiskBoxEngine.js'
import type { TrendlineFailureSetupStatus } from './trendlineFailureSetup.js'
import type { WeakCountermoveTrendlineStatus } from './weakCountermoveTrendlineEngine.js'
import type { WrongSidedTraderResult } from './wrongSidedTraderDetector.js'

export type TraderVideoAnalyticalFinalDecision =
  | 'GOOD_ENTRY'
  | 'ACCEPTABLE_ENTRY'
  | 'WEAK_ENTRY'
  | 'NO_TRADE'

export type TraderVideoAnalyticalBlockReason =
  | 'BLOCKED_STORY_INCOMPLETE'
  | 'BLOCKED_NO_MARK_INTERACTION'
  | 'BLOCKED_NO_CLEAR_TRAPPED_SIDE'
  | 'BLOCKED_INSTITUTIONAL_PRESSURE_WEAK'
  | 'BLOCKED_PULLBACK_NOT_WEAK'
  | 'BLOCKED_TRENDLINE_LOW_QUALITY'
  | 'BLOCKED_CANDLE_CONFIRMATION_WEAK'
  | 'BLOCKED_NO_RETEST_FAILURE'
  | 'BLOCKED_RED_GREEN_NOT_GOOD_ENOUGH'
  | 'BLOCKED_RR_BELOW_2'
  | 'BLOCKED_DATA_CONFIDENCE_LOW'
  | 'BLOCKED_CONTEXT_CONFLICT'

export type TraderVideoAnalyticalDecision = {
  blockedReasons: TraderVideoAnalyticalBlockReason[]
  componentScores: {
    contextScore: number
    dataConfidenceScore: number
    institutionalPressureScore: number
    markInteractionScore: number
    redGreenScore: number
    retestFailureScore: number
    trappedTraderScore: number
    trendlineQualityScore: number
    candlestickConfirmationScore: number
    weakCountermoveScore: number
  }
  finalDecision: TraderVideoAnalyticalFinalDecision
  humanReasoning: string
  nextRequiredCondition: string
  overallTradeQualityScore: number
  timestamp: string
}

export type TraderVideoSpecialistAgentName =
  | 'CONTEXT_AGENT'
  | 'TRAPPED_TRADER_AGENT'
  | 'INSTITUTIONAL_PRESSURE_AGENT'
  | 'WEAK_COUNTERMOVE_AGENT'
  | 'TRENDLINE_AGENT'
  | 'CANDLESTICK_AGENT'
  | 'RETEST_AGENT'
  | 'RED_GREEN_RISK_AGENT'
  | 'DATA_CONFIDENCE_AGENT'

export type TraderVideoSpecialistVote = {
  agent: TraderVideoSpecialistAgentName
  evidence: string[]
  reason: string
  score: number
  verdict: 'PASS' | 'WAIT' | 'BLOCK'
}

export type TraderVideoAgentAuthority = {
  canOpenTactically: boolean
  decisionOwner: 'LEAD_ANALYTICAL_AGENT'
  finalTacticalDecision: TraderVideoAnalyticalFinalDecision
  leadReasoning: string
  mode: 'TRADER_VIDEO_AGENT_AUTHORITY'
  nextRequiredCondition: string
  paperGateRole: 'SAFETY_AND_EXECUTION_VETO_ONLY'
  specialistVotes: TraderVideoSpecialistVote[]
  tacticalBlockers: TraderVideoAnalyticalBlockReason[]
  timestamp: string
}

export type TraderVideoAnalyticalAgentInput = {
  bookmapContext?: BookmapLiquidityLayerStatus | null
  currentPrice?: number | null
  currentTimeNY?: string | null
  dataQuality: {
    barsCount: number
    feedFresh?: boolean
    hasLevels: boolean
    hasTimezoneClarity?: boolean
    marketClosed?: boolean
  }
  movementNature?: MovementNatureResult | null
  openingRange?: OpeningRangeObserverStatus | null
  premarketLevels?: PremarketLevelBuilderStatus | null
  redGreenBox?: RedGreenRiskBox | null
  sessionDate?: string | null
  sessionPhase: string
  structuralRiskReward?: RedGreenRiskBox['riskReward'] | null
  symbol?: string | null
  testedLevel?: string | null
  trendlineFailure?: TrendlineFailureSetupStatus | null
  weakCountermove?: WeakCountermoveTrendlineStatus | null
  wrongSidedTrader?: WrongSidedTraderResult | null
}

function vote(score: number, blockThreshold: number, passThreshold: number): TraderVideoSpecialistVote['verdict'] {
  if (score < blockThreshold) return 'BLOCK'
  if (score >= passThreshold) return 'PASS'
  return 'WAIT'
}

function specialistVotes(input: TraderVideoAnalyticalDecision): TraderVideoSpecialistVote[] {
  const scores = input.componentScores
  return [
    {
      agent: 'CONTEXT_AGENT',
      evidence: ['Ventana NY', 'niveles previos', 'opening range', 'VWAP/contexto'],
      reason: scores.contextScore >= 60 ? 'El contexto del metodo es utilizable.' : 'Falta contexto limpio del metodo antes de pensar en entrada.',
      score: scores.contextScore,
      verdict: vote(scores.contextScore, 60, 80),
    },
    {
      agent: 'TRAPPED_TRADER_AGENT',
      evidence: ['interaccion con ORH/ORL', 'fake break', 'compradores/vendedores atrapados'],
      reason: scores.trappedTraderScore >= 60 ? 'Hay evidencia de un lado atrapado.' : 'No hay compradores o vendedores atrapados con claridad.',
      score: scores.trappedTraderScore,
      verdict: vote(scores.trappedTraderScore, 60, 78),
    },
    {
      agent: 'INSTITUTIONAL_PRESSURE_AGENT',
      evidence: ['impulso dominante', 'asimetria del movimiento', 'continuidad', 'rechazo'],
      reason: scores.institutionalPressureScore >= 45 ? 'La presion dominante existe.' : 'La presion dominante aun es debil o confusa.',
      score: scores.institutionalPressureScore,
      verdict: vote(scores.institutionalPressureScore, 45, 75),
    },
    {
      agent: 'WEAK_COUNTERMOVE_AGENT',
      evidence: ['pullback lento', 'solapamiento', 'poco avance', 'falta de continuidad'],
      reason: scores.weakCountermoveScore >= 55 ? 'El contramovimiento muestra debilidad suficiente para vigilar.' : 'El contramovimiento no esta debil; podria ser flujo fuerte contrario.',
      score: scores.weakCountermoveScore,
      verdict: vote(scores.weakCountermoveScore, 55, 75),
    },
    {
      agent: 'TRENDLINE_AGENT',
      evidence: ['linea de tres puntos', 'calidad de anclas', 'pendiente', 'rol support/resistance'],
      reason: scores.trendlineQualityScore >= 65 ? 'La trendline de tres puntos tiene calidad operable.' : 'La trendline no tiene tres puntos limpios/calidad suficiente.',
      score: scores.trendlineQualityScore,
      verdict: vote(scores.trendlineQualityScore, 65, 80),
    },
    {
      agent: 'CANDLESTICK_AGENT',
      evidence: ['vela de ruptura', 'cierre mas alla de la linea', 'mecha de rechazo', 'vela de retest fallido'],
      reason: scores.candlestickConfirmationScore >= 70 ? 'Las velas japonesas confirman ruptura y retest fallido.' : 'Las velas todavia no confirman la lectura; puede ser solo mecha o retest incompleto.',
      score: scores.candlestickConfirmationScore,
      verdict: vote(scores.candlestickConfirmationScore, 60, 78),
    },
    {
      agent: 'RETEST_AGENT',
      evidence: ['ruptura de trendline', 'intento de volver', 'fallo de recuperacion'],
      reason: scores.retestFailureScore >= 75 ? 'El retest fallido confirma que el lado debil no pudo volver.' : 'Falta ruptura con retest fallido; no hay gatillo final.',
      score: scores.retestFailureScore,
      verdict: vote(scores.retestFailureScore, 75, 85),
    },
    {
      agent: 'RED_GREEN_RISK_AGENT',
      evidence: ['stop tecnico', 'target estructural', 'R/R >= 2', 'costos <= 30%'],
      reason: scores.redGreenScore >= 75 ? 'La caja rojo/verde paga el riesgo minimo requerido.' : 'La zona roja/verde no justifica el riesgo.',
      score: scores.redGreenScore,
      verdict: vote(scores.redGreenScore, 75, 85),
    },
    {
      agent: 'DATA_CONFIDENCE_AGENT',
      evidence: ['velas M1 reales', 'feed fresco', 'niveles', 'zona horaria NY'],
      reason: scores.dataConfidenceScore >= 90 ? 'Los datos son confiables para decision paper.' : 'Los datos no tienen confianza suficiente para decidir.',
      score: scores.dataConfidenceScore,
      verdict: vote(scores.dataConfidenceScore, 90, 95),
    },
  ]
}

export function buildTraderVideoAgentAuthority(decision: TraderVideoAnalyticalDecision): TraderVideoAgentAuthority {
  return {
    canOpenTactically: decision.finalDecision === 'GOOD_ENTRY' || decision.finalDecision === 'ACCEPTABLE_ENTRY',
    decisionOwner: 'LEAD_ANALYTICAL_AGENT',
    finalTacticalDecision: decision.finalDecision,
    leadReasoning: decision.humanReasoning,
    mode: 'TRADER_VIDEO_AGENT_AUTHORITY',
    nextRequiredCondition: decision.nextRequiredCondition,
    paperGateRole: 'SAFETY_AND_EXECUTION_VETO_ONLY',
    specialistVotes: specialistVotes(decision),
    tacticalBlockers: decision.blockedReasons,
    timestamp: decision.timestamp,
  }
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasCoreLevels(levels: PremarketLevelBuilderStatus | null | undefined) {
  if (!levels) return false
  return [
    levels.previousDayHigh,
    levels.previousDayLow,
    levels.previousDayClose,
    levels.overnightHigh,
    levels.overnightLow,
  ].every(finite)
}

function contextScore(input: TraderVideoAnalyticalAgentInput) {
  let score = 0
  if (input.symbol) score += 8
  if (input.sessionPhase === 'MAIN_WINDOW') score += 25
  else if (input.sessionPhase === 'FIRST_15_MINUTES') score += 10
  else if (input.sessionPhase === 'MARKET_CLOSED') score -= 20
  if (hasCoreLevels(input.premarketLevels)) score += 8
  if (input.openingRange?.state === 'OPENING_RANGE_COMPLETED') score += 20
  if (finite(input.openingRange?.openingRangeHigh) && finite(input.openingRange?.openingRangeLow)) score += 12
  if (finite(input.premarketLevels?.vwap)) score += 8
  if (input.weakCountermove?.openingRangeLevel) score += 7
  return clamp(score)
}

function markInteractionScore(input: TraderVideoAnalyticalAgentInput) {
  let score = 0
  const opening = input.openingRange
  const trap = input.wrongSidedTrader ?? input.weakCountermove?.wrongSidedTrader
  const failedLevel = trap?.failedLevel

  if (!hasCoreLevels(input.premarketLevels)) return 0
  if (opening?.state === 'OPENING_RANGE_COMPLETED') score += 15
  if (opening?.fakeBreakAbove || opening?.fakeBreakBelow) score += 25
  if (opening?.reactionAtPreviousLevels) score += 15
  if (input.weakCountermove?.openingRangeLevel) score += 20
  if (failedLevel === 'openingRangeHigh' || failedLevel === 'openingRangeLow') score += 30
  else if (failedLevel === 'overnightHigh' || failedLevel === 'overnightLow' || failedLevel === 'previousDayHigh' || failedLevel === 'previousDayLow') score += 18
  if (finite(trap?.failedLevelPrice) && finite(trap?.reclaimOrRejectPrice)) score += 10
  if (input.testedLevel) score += 8

  return clamp(score)
}

function trappedTraderScore(input: TraderVideoAnalyticalAgentInput) {
  const trap = input.wrongSidedTrader ?? input.weakCountermove?.wrongSidedTrader
  if (!trap || trap.wrongSidedState === 'NONE') return 0
  let score = trap.confidence
  if (trap.failedLevel === 'openingRangeHigh' || trap.failedLevel === 'openingRangeLow') score += 15
  if (finite(trap.likelyStopZone)) score += 8
  if (finite(trap.failedLevelPrice)) score += 5
  return clamp(score)
}

function institutionalPressureScore(input: TraderVideoAnalyticalAgentInput) {
  const movement = input.movementNature ?? input.weakCountermove?.movementNature
  if (!movement) return 0
  return clamp(
    movement.institutionalPressureScore * 0.62
    + movement.impulseStrength * 0.16
    + movement.continuationStrength * 0.10
    + movement.volumeConfirmation * 0.06
    + movement.wickRejection * 0.06,
  )
}

function weakCountermoveScore(input: TraderVideoAnalyticalAgentInput) {
  const weak = input.weakCountermove
  if (!weak) return 0
  let score = weak.weakCountermoveScore
  if (weak.counterMoveBars >= 5) score += 10
  if (weak.state !== 'BLOCKED_NO_WEAK_COUNTERMOVE') score += 10
  return clamp(score)
}

function trendlineQualityScore(input: TraderVideoAnalyticalAgentInput) {
  const trendline = input.trendlineFailure?.trendline ?? input.weakCountermove?.trendlineFailure?.trendline
  if (!trendline) return 0
  let score = 35
  if ((trendline.anchorCount ?? 0) >= 3) score += 25
  score += Math.min(25, (trendline.qualityScore ?? 0) * 0.25)
  if (Math.abs(trendline.slopePerMinute) > 0) score += 8
  if (trendline.role === 'RISING_SUPPORT' || trendline.role === 'FALLING_RESISTANCE') score += 7
  return clamp(score)
}

function retestFailureScore(input: TraderVideoAnalyticalAgentInput) {
  const failure = input.trendlineFailure ?? input.weakCountermove?.trendlineFailure
  if (!failure) return 0
  if (failure.state === 'RECOVERY_ATTEMPT_FAILED' && failure.canUseForEntry) {
    return clamp(75 + Math.min(20, failure.attemptedRecoveryCount * 8))
  }
  if (failure.state === 'BROKEN_WITHOUT_RETEST') return 45
  if (failure.state === 'RECOVERY_STILL_HOLDING') return 55
  if (failure.state === 'TRENDLINE_ACTIVE') return 35
  return 0
}

function candlestickConfirmationScore(input: TraderVideoAnalyticalAgentInput) {
  const expert = input.weakCountermove?.trendlineCandlestickExpert
  if (expert) return clamp(expert.overallScore)
  const failure = input.trendlineFailure ?? input.weakCountermove?.trendlineFailure
  if (failure?.state === 'RECOVERY_ATTEMPT_FAILED' && failure.canUseForEntry) return 68
  if (failure?.state === 'BROKEN_WITHOUT_RETEST') return 42
  if (failure?.state === 'RECOVERY_STILL_HOLDING') return 50
  return 0
}

function redGreenScore(input: TraderVideoAnalyticalAgentInput) {
  const box = input.redGreenBox
  const rr = input.structuralRiskReward ?? box?.riskReward
  if (!box || !rr) return 0
  let score = 0
  if (box.technicalStop !== null) score += 18
  if (box.structuralTarget !== null) score += 18
  if (rr.riskRewardRatio >= 2) score += 30
  else score += clamp(rr.riskRewardRatio / 2 * 25)
  if (rr.costToTargetRatio <= 0.30) score += 18
  if (rr.expectedNetProfit > 0) score += 10
  if (box.state === 'VALID_RED_GREEN_BOX' && rr.decision === 'APPROVED') score += 6
  return clamp(score)
}

function dataConfidenceScore(input: TraderVideoAnalyticalAgentInput) {
  let score = 0
  if (input.dataQuality.barsCount >= 60) score += 25
  else if (input.dataQuality.barsCount >= 20) score += 15
  if (input.dataQuality.hasLevels) score += 25
  if (input.openingRange?.state === 'OPENING_RANGE_COMPLETED') score += 15
  if (input.dataQuality.feedFresh !== false) score += 15
  if (input.dataQuality.hasTimezoneClarity !== false) score += 10
  if (!input.dataQuality.marketClosed) score += 10
  return clamp(score)
}

function buildBlockers(input: {
  context: number
  data: number
  institutional: number
  markInteraction: number
  redGreen: number
  retest: number
  trapped: number
  trendline: number
  candle: number
  weak: number
  rrDecision?: RedGreenRiskBox['riskReward'] | null
}): TraderVideoAnalyticalBlockReason[] {
  const blockers: TraderVideoAnalyticalBlockReason[] = []
  if (input.context < 60) blockers.push('BLOCKED_CONTEXT_CONFLICT')
  if (input.markInteraction < 60) blockers.push('BLOCKED_NO_MARK_INTERACTION')
  if (input.trapped < 60) blockers.push('BLOCKED_NO_CLEAR_TRAPPED_SIDE')
  if (input.institutional < 45) blockers.push('BLOCKED_INSTITUTIONAL_PRESSURE_WEAK')
  if (input.weak < 55) blockers.push('BLOCKED_PULLBACK_NOT_WEAK')
  if (input.trendline < 65) blockers.push('BLOCKED_TRENDLINE_LOW_QUALITY')
  if (input.trendline >= 65 && input.retest >= 45 && input.candle < 68) blockers.push('BLOCKED_CANDLE_CONFIRMATION_WEAK')
  if (input.retest < 75) blockers.push('BLOCKED_NO_RETEST_FAILURE')
  if (
    input.redGreen < 75
    || !input.rrDecision
    || input.rrDecision.costToTargetRatio > 0.30
    || input.rrDecision.decision !== 'APPROVED'
  ) blockers.push('BLOCKED_RED_GREEN_NOT_GOOD_ENOUGH')
  if (!input.rrDecision || input.rrDecision.riskRewardRatio < 2) blockers.push('BLOCKED_RR_BELOW_2')
  if (input.data < 90) blockers.push('BLOCKED_DATA_CONFIDENCE_LOW')
  if (blockers.length && blockers.length >= 3) blockers.unshift('BLOCKED_STORY_INCOMPLETE')
  return [...new Set(blockers)]
}

function firstMissingCondition(blockers: TraderVideoAnalyticalBlockReason[]) {
  const blocker = blockers[0]
  if (!blocker) return 'La historia esta completa; pasar a paper gate si safety sigue limpio.'
  const map: Record<TraderVideoAnalyticalBlockReason, string> = {
    BLOCKED_CONTEXT_CONFLICT: 'Esperar contexto limpio dentro de ventana NY y cerca de niveles relevantes.',
    BLOCKED_DATA_CONFIDENCE_LOW: 'Confirmar velas M1 reales, niveles y reloj NY antes de evaluar entrada.',
    BLOCKED_INSTITUTIONAL_PRESSURE_WEAK: 'Esperar impulso dominante mas claro antes del pullback.',
    BLOCKED_NO_MARK_INTERACTION: 'Esperar que el precio interactue con las marcas: prueba, rechazo, aceptacion fallida o traders atrapados.',
    BLOCKED_NO_CLEAR_TRAPPED_SIDE: 'Esperar fallo claro en ORH/ORL que deje compradores o vendedores atrapados.',
    BLOCKED_NO_RETEST_FAILURE: 'Esperar ruptura de trendline y retest fallido.',
    BLOCKED_PULLBACK_NOT_WEAK: 'Esperar contramovimiento lento, solapado y sin continuidad.',
    BLOCKED_RED_GREEN_NOT_GOOD_ENOUGH: 'Esperar stop tecnico y target estructural con R:R minimo 1:2 y costo <= 30%.',
    BLOCKED_RR_BELOW_2: 'Esperar una zona roja/verde con relacion riesgo/beneficio minima 1:2.',
    BLOCKED_STORY_INCOMPLETE: 'Completar la historia: contexto, atrapados, presion, pullback debil, ruptura, retest y rojo/verde.',
    BLOCKED_CANDLE_CONFIRMATION_WEAK: 'Esperar vela cerrada de ruptura y vela de rechazo en el retest; no operar solo por la linea.',
    BLOCKED_TRENDLINE_LOW_QUALITY: 'Esperar trendline de 3 puntos limpios sobre el contramovimiento correcto.',
  }
  return map[blocker]
}

function finalDecision(input: {
  blockers: TraderVideoAnalyticalBlockReason[]
  data: number
  overall: number
  redGreen: number
  retest: number
  trapped: number
  candle: number
  weak: number
}) {
  if (
    input.overall >= 85
    && input.redGreen >= 80
    && input.trapped >= 75
    && input.weak >= 75
    && input.retest >= 75
    && input.candle >= 70
    && input.data >= 90
    && input.blockers.length === 0
  ) return 'GOOD_ENTRY' as const
  if (
    input.overall >= 75
    && input.redGreen >= 75
    && input.candle >= 68
    && input.blockers.length === 0
  ) return 'ACCEPTABLE_ENTRY' as const
  if (input.blockers.some((blocker) => [
    'BLOCKED_CONTEXT_CONFLICT',
    'BLOCKED_DATA_CONFIDENCE_LOW',
    'BLOCKED_NO_MARK_INTERACTION',
    'BLOCKED_INSTITUTIONAL_PRESSURE_WEAK',
    'BLOCKED_NO_CLEAR_TRAPPED_SIDE',
    'BLOCKED_PULLBACK_NOT_WEAK',
    'BLOCKED_TRENDLINE_LOW_QUALITY',
    'BLOCKED_CANDLE_CONFIRMATION_WEAK',
    'BLOCKED_NO_RETEST_FAILURE',
    'BLOCKED_RED_GREEN_NOT_GOOD_ENOUGH',
    'BLOCKED_RR_BELOW_2',
  ].includes(blocker))) return 'NO_TRADE' as const
  if (input.overall >= 60 && input.blockers.length) return 'WEAK_ENTRY' as const
  return 'NO_TRADE' as const
}

function humanReasoning(input: {
  blockers: TraderVideoAnalyticalBlockReason[]
  decision: TraderVideoAnalyticalFinalDecision
  rr?: RedGreenRiskBox['riskReward'] | null
  side: 'BUYERS' | 'SELLERS' | 'NONE'
  weak?: WeakCountermoveTrendlineStatus | null
}) {
  if (input.decision === 'GOOD_ENTRY' || input.decision === 'ACCEPTABLE_ENTRY') {
    const direction = input.side === 'BUYERS' ? 'short' : input.side === 'SELLERS' ? 'long' : 'paper'
    const rrText = input.rr ? `R:R ${input.rr.riskRewardRatio.toFixed(2)} y costo ${(input.rr.costToTargetRatio * 100).toFixed(1)}% del target` : 'R:R aprobado'
    return `${input.side === 'BUYERS' ? 'Compradores' : 'Vendedores'} quedaron atrapados en el opening range. El contramovimiento fue debil, la trendline de 3 puntos fue rota y el retest fallo. La zona roja/verde tiene ${rrText}. Entrada paper ${direction} valida.`
  }
  if (input.blockers.includes('BLOCKED_CONTEXT_CONFLICT')) {
    return 'No hay entrada. El contexto del metodo no esta limpio: debe estar dentro de la ventana NY valida y con niveles previos/opening range disponibles.'
  }
  if (input.blockers.includes('BLOCKED_DATA_CONFIDENCE_LOW')) {
    return 'No hay entrada. Faltan datos confiables: velas M1 reales, niveles calculados, feed fresco o claridad de horario NY.'
  }
  if (input.blockers.includes('BLOCKED_NO_MARK_INTERACTION')) {
    return 'No hay entrada. Las marcas estan dibujadas, pero el precio no las ha analizado con accion real: falta prueba, rechazo, fallo o lado atrapado.'
  }
  if (input.blockers.includes('BLOCKED_NO_CLEAR_TRAPPED_SIDE')) {
    return 'No hay entrada. Aun no existe evidencia clara de compradores o vendedores atrapados en ORH/ORL; una trendline aislada no basta.'
  }
  if (input.blockers.includes('BLOCKED_NO_RETEST_FAILURE')) {
    return 'No hay entrada. La historia esta incompleta: puede haber contexto y trendline, pero falta el retest fallido que confirma que el lado debil no pudo volver.'
  }
  if (input.blockers.includes('BLOCKED_CANDLE_CONFIRMATION_WEAK')) {
    return 'No hay entrada. La trendline puede estar trazada, pero las velas japonesas no confirman: se exige cierre real de ruptura y vela de rechazo/fallo en el retest.'
  }
  if (input.blockers.includes('BLOCKED_RED_GREEN_NOT_GOOD_ENOUGH')) {
    return 'No hay entrada. El stop/objetivo no justifica el riesgo: se exige R:R minimo 1:2 y costo controlado.'
  }
  if (input.blockers.includes('BLOCKED_RR_BELOW_2')) {
    return 'No hay entrada. La zona verde no paga al menos dos veces la zona roja; el metodo exige R:R minimo 1:2.'
  }
  if (input.blockers.includes('BLOCKED_PULLBACK_NOT_WEAK')) {
    return 'No hay entrada. El pullback todavia no demuestra debilidad suficiente; puede ser participacion fuerte y no contramovimiento debil.'
  }
  return 'No hay entrada. La historia del trade todavia no esta completa como en el metodo del video.'
}

export function analyzeTraderVideoEntry(input: TraderVideoAnalyticalAgentInput): TraderVideoAnalyticalDecision {
  const context = contextScore(input)
  const markInteraction = markInteractionScore(input)
  const trapped = trappedTraderScore(input)
  const institutional = institutionalPressureScore(input)
  const weak = weakCountermoveScore(input)
  const trendline = trendlineQualityScore(input)
  const retest = retestFailureScore(input)
  const candle = candlestickConfirmationScore(input)
  const redGreen = redGreenScore(input)
  const data = dataConfidenceScore(input)
  const rr = input.structuralRiskReward ?? input.redGreenBox?.riskReward ?? null
  const overall = round(
    context * 0.10
    + markInteraction * 0.10
    + trapped * 0.12
    + institutional * 0.10
    + weak * 0.11
    + trendline * 0.10
    + retest * 0.12
    + candle * 0.10
    + redGreen * 0.11
    + data * 0.04,
  )
  const blockers = buildBlockers({
    context,
    data,
    institutional,
    markInteraction,
    redGreen,
    retest,
    rrDecision: rr,
    trapped,
    trendline,
    candle,
    weak,
  })
  const decision = finalDecision({
    blockers,
    data,
    overall,
    redGreen,
    retest,
    trapped,
    candle,
    weak,
  })
  return {
    blockedReasons: blockers,
    componentScores: {
      contextScore: round(context),
      dataConfidenceScore: round(data),
      institutionalPressureScore: round(institutional),
      markInteractionScore: round(markInteraction),
      redGreenScore: round(redGreen),
      retestFailureScore: round(retest),
      trappedTraderScore: round(trapped),
      trendlineQualityScore: round(trendline),
      candlestickConfirmationScore: round(candle),
      weakCountermoveScore: round(weak),
    },
    finalDecision: decision,
    humanReasoning: humanReasoning({
      blockers,
      decision,
      rr,
      side: input.weakCountermove?.trappedSide ?? input.wrongSidedTrader?.trappedSide ?? 'NONE',
      weak: input.weakCountermove,
    }),
    nextRequiredCondition: firstMissingCondition(blockers),
    overallTradeQualityScore: overall,
    timestamp: new Date().toISOString(),
  }
}
