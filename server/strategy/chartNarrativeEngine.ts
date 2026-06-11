import type { TraderVideoReplicationStatus } from './traderVideoReplicationMode.js'

export type ChartNarrativeBias = 'SHORT' | 'LONG' | 'NONE'

export type ChartNarrativeStatus = {
  bias: ChartNarrativeBias
  confidence: number
  evidence: string[]
  invalidation: string
  markInteraction: {
    levelName: string | null
    levelPrice: number | null
    quality: 'NONE' | 'TESTING' | 'FAILED_BREAK' | 'ACCEPTED_BREAK'
    score: number
  }
  missing: string[]
  narrative: string
  nextQuestion: string
  timestamp: string
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function scoreFromAnalytical(status: TraderVideoReplicationStatus) {
  const scores = status.analyticalDecision.componentScores
  return round(
    scores.markInteractionScore * 0.22
    + scores.trappedTraderScore * 0.20
    + scores.institutionalPressureScore * 0.12
    + scores.weakCountermoveScore * 0.14
    + scores.trendlineQualityScore * 0.12
    + scores.retestFailureScore * 0.12
    + scores.redGreenScore * 0.08,
  )
}

function levelName(status: TraderVideoReplicationStatus) {
  const failed = status.wrongSidedTrader?.failedLevel
  if (failed === 'openingRangeHigh') return 'ORH 09:30-09:45'
  if (failed === 'openingRangeLow') return 'ORL 09:30-09:45'
  if (failed === 'previousDayHigh') return 'Cash 09:30-16:00 high'
  if (failed === 'previousDayLow') return 'Cash 09:30-16:00 low'
  if (failed === 'overnightHigh') return 'ON 16:00-09:30 high'
  if (failed === 'overnightLow') return 'ON 16:00-09:30 low'
  if (status.weakCountermoveTrendline?.openingRangeLevel === 'HIGH') return 'ORH 09:30-09:45'
  if (status.weakCountermoveTrendline?.openingRangeLevel === 'LOW') return 'ORL 09:30-09:45'
  return null
}

function interactionQuality(status: TraderVideoReplicationStatus): ChartNarrativeStatus['markInteraction']['quality'] {
  if (status.state === 'BREAKOUT_ACCEPTED') return 'ACCEPTED_BREAK'
  if (status.wrongSidedTrader?.trappedSide === 'BUYERS' || status.wrongSidedTrader?.trappedSide === 'SELLERS') return 'FAILED_BREAK'
  if (status.state === 'TESTING_OPENING_RANGE_HIGH' || status.state === 'TESTING_OPENING_RANGE_LOW') return 'TESTING'
  return 'NONE'
}

export function buildChartNarrative(status: TraderVideoReplicationStatus, now = new Date()): ChartNarrativeStatus {
  const side = status.weakCountermoveTrendline?.intendedDirection ?? 'NONE'
  const trapped = status.wrongSidedTrader?.trappedSide ?? status.weakCountermoveTrendline?.trappedSide ?? 'NONE'
  const evidence: string[] = []
  const missing: string[] = []

  if (status.premarketLevels.state === 'MARKING_PREMARKET_LEVELS') {
    evidence.push('Mapa previo listo: cash high/low, overnight high/low y cierre cash.')
  } else {
    missing.push('Construir mapa previo completo antes de leer la historia.')
  }

  if (status.openingRange.state === 'OPENING_RANGE_COMPLETED') {
    evidence.push(`Opening range completo: ORH ${status.openingRange.openingRangeHigh ?? '-'} / ORL ${status.openingRange.openingRangeLow ?? '-'}.`)
  } else {
    missing.push('Esperar cierre del rango 09:30-09:45 NY.')
  }

  if (trapped === 'BUYERS') evidence.push('Compradores quedaron atrapados; solo se considera short si el resto confirma.')
  else if (trapped === 'SELLERS') evidence.push('Vendedores quedaron atrapados; solo se considera long si el resto confirma.')
  else missing.push('Falta evidencia clara de compradores o vendedores atrapados contra una marca.')

  if (status.movementNature) evidence.push(status.movementNature.explanation)
  else missing.push('Falta leer impulso dominante y naturaleza del pullback.')

  if (status.weakCountermoveTrendline?.weakCountermoveScore && status.weakCountermoveTrendline.weakCountermoveScore >= 55) {
    evidence.push(`Pullback debil detectado (${status.weakCountermoveTrendline.weakCountermoveScore}/100).`)
  } else {
    missing.push('Falta pullback debil: poco avance, solapamiento y falta de continuidad.')
  }

  if ((status.trendlineFailure?.trendline?.anchorCount ?? 0) >= 3) {
    evidence.push('Trendline de tres puntos disponible sobre el contramovimiento.')
  } else {
    missing.push('Falta trendline de tres puntos limpios.')
  }

  if (status.trendlineFailure?.state === 'RECOVERY_ATTEMPT_FAILED') {
    evidence.push('Retest fallido confirmado despues de romper trendline.')
  } else {
    missing.push('Falta ruptura de trendline y retest fallido.')
  }

  if (status.redGreenRiskBox?.riskReward.decision === 'APPROVED' && status.redGreenRiskBox.riskReward.riskRewardRatio >= 2) {
    evidence.push(`Caja rojo/verde aprobada: R/R ${status.redGreenRiskBox.riskReward.riskRewardRatio.toFixed(2)}.`)
  } else {
    missing.push('Falta stop/objetivo con R/R minimo 1:2.')
  }

  const interactionScore = status.analyticalDecision.componentScores.markInteractionScore ?? 0
  const bias: ChartNarrativeBias = side === 'SHORT' || side === 'LONG' ? side : 'NONE'
  const quality = interactionQuality(status)
  const confidence = scoreFromAnalytical(status)
  const interaction = {
    levelName: levelName(status),
    levelPrice: status.wrongSidedTrader?.failedLevelPrice ?? null,
    quality,
    score: interactionScore,
  }
  const directionText = bias === 'SHORT'
    ? 'tesis bajista'
    : bias === 'LONG'
      ? 'tesis alcista'
      : 'sin tesis operable'
  const narrative = quality === 'FAILED_BREAK'
    ? `El precio interactuo con ${interaction.levelName ?? 'una marca clave'} y fallo. Hay ${directionText}, pero solo es trade si pullback, trendline, retest y R/R completan la historia.`
    : quality === 'TESTING'
      ? `El precio esta probando ${interaction.levelName ?? 'una marca clave'}; todavia no hay fallo ni aceptacion confirmada.`
      : quality === 'ACCEPTED_BREAK'
        ? 'La ruptura esta siendo aceptada; no se persigue contra un jugador institucional que sostiene el nivel.'
        : 'Las marcas existen, pero todavia no hay interaccion suficiente para construir una tesis.'

  return {
    bias,
    confidence,
    evidence,
    invalidation: status.redGreenRiskBox?.technicalStop
      ? `Invalida si toca stop tecnico ${status.redGreenRiskBox.technicalStop}.`
      : 'Invalida si el precio acepta el nivel contra la tesis o no hay stop tecnico claro.',
    markInteraction: interaction,
    missing,
    narrative,
    nextQuestion: missing[0] ?? 'La historia esta completa; solo paper gate puede decidir.',
    timestamp: now.toISOString(),
  }
}
