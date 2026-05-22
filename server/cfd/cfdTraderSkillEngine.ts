import type { AccountSnapshot } from '../risk/accountHealthGuard.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'
import type { CfdPosition } from '../storage/tradeStore.js'
import type { AgentEffectivenessStatus } from '../performance/agentEffectivenessEngine.js'
import { minimumRotationHoldSeconds } from './positionRotationEngine.js'

export type CfdTraderSkillReadout = {
  mode: 'HUNTING' | 'MANAGING' | 'ROTATING' | 'DEFENSIVE' | 'MEASURING'
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  reading: string
  headline: string
  thesis: string
  strongestOpportunity: {
    cfdSymbol: string
    reason: string
    score: number
    expectedNetProfit: number
    spreadBps: number
  } | null
  weakestPosition: {
    cfdSymbol: string
    openPnl: number
    ageMinutes: number
    reason: string
  } | null
  surpriseMove: string
  surprisePlay: string
  tacticalPlan: string[]
  tacticalPlanText: string
  riskWarning: string
  riskWatched: string | null
  whatWouldChangeMind: string
  changeOfMindTrigger: string
  suggestedActions: TraderSkillAction[]
  executableActions: TraderSkillAction[]
  actionsTaken: TraderSkillAction[]
  blockedActions: TraderSkillAction[]
}

export type TraderSkillAction = {
  type:
    | 'BLOCK_NEW_ENTRIES'
    | 'BLOCK_WEAK_ENTRY'
    | 'CLOSE_STALE_NEGATIVE_POSITION'
    | 'HOLD_WINNERS'
    | 'MANAGE_REVIEW'
    | 'ROTATE_CAPITAL'
    | 'WATCH_RISK_POSITION'
  symbol?: string
  reason: string
}

function ageMinutes(position: CfdPosition) {
  return Math.max(0, (Date.now() - new Date(position.openedAt).getTime()) / 60_000)
}

function minimumRotationHoldMinutes() {
  return minimumRotationHoldSeconds() / 60
}

function opportunityRank(opportunity: Opportunity) {
  const costPenalty = Math.max(0, opportunity.quote.spreadBps ?? 0)
  return (opportunity.cfdExpertScore ?? opportunity.opportunityScore) + (opportunity.expectedNetProfit ?? 0) * 4 - costPenalty * 0.4
}

function weakestPosition(positions: CfdPosition[]) {
  return [...positions].sort((a, b) => {
    const aScore = a.openPnl - ageMinutes(a) * 0.015 - (a.minimumMoveBps ?? 150) * 0.002
    const bScore = b.openPnl - ageMinutes(b) * 0.015 - (b.minimumMoveBps ?? 150) * 0.002
    return aScore - bScore
  })[0] ?? null
}

export function buildCfdTraderSkillReadout(input: {
  account: AccountSnapshot
  actionsTaken?: TraderSkillAction[]
  blockedActions?: TraderSkillAction[]
  effectiveness: ReturnType<typeof import('../performance/agentEffectivenessEngine.js').buildAgentEffectiveness>
  opportunities: Opportunity[]
  positions: CfdPosition[]
}) {
  const actionable = input.opportunities
    .filter((opportunity) => opportunity.setupConfirmed && opportunity.opportunityScore >= 85)
    .sort((a, b) => opportunityRank(b) - opportunityRank(a))
  const best = actionable[0] ?? null
  const weakest = weakestPosition(input.positions)
  const marginTight = input.account.marginLevel < 115 || input.account.freeMargin < input.account.equity * 0.05
  const staleWeak = weakest ? weakest.openPnl <= -1 && ageMinutes(weakest) >= minimumRotationHoldMinutes() : false
  const openSymbols = new Set(input.positions.map((position) => position.cfdSymbol))
  const freshBest = best && !openSymbols.has(best.cfdSymbol) ? best : actionable.find((item) => !openSymbols.has(item.cfdSymbol)) ?? null
  const slotsAvailable = Math.max(0, 10 - input.positions.length)

  let mode: CfdTraderSkillReadout['mode'] = 'MEASURING'
  if (marginTight) mode = 'DEFENSIVE'
  else if (staleWeak && freshBest) mode = 'ROTATING'
  else if (freshBest && slotsAvailable > 0) mode = 'HUNTING'
  else if (input.positions.length) mode = 'MANAGING'

  const confidence: CfdTraderSkillReadout['confidence'] = input.effectiveness.closedToday >= 10
    ? input.effectiveness.status === 'EFFECTIVE' ? 'HIGH' : input.effectiveness.status === 'WATCH' ? 'MEDIUM' : 'LOW'
    : best ? 'MEDIUM' : 'LOW'

  const headline = mode === 'ROTATING'
    ? `La jugada no es abrir mas: es reciclar ${weakest?.cfdSymbol} hacia ${freshBest?.cfdSymbol}.`
    : mode === 'HUNTING'
      ? `Hay espacio para atacar: ${freshBest?.cfdSymbol} es la mejor nueva entrada paper.`
      : mode === 'DEFENSIVE'
        ? 'El trader esta en defensa: proteger margen antes de buscar otra entrada.'
        : mode === 'MANAGING'
          ? 'El edge ahora esta en gestionar: dejar correr lo bueno y cortar lo que se estanque.'
          : 'Aun no hay muestra suficiente; el skill esta midiendo calidad real.'

  const thesis = freshBest
    ? `${freshBest.cfdSymbol} combina score ${(freshBest.cfdExpertScore ?? freshBest.opportunityScore).toFixed(0)}, expected net $${(freshBest.expectedNetProfit ?? 0).toFixed(2)} y spread ${freshBest.quote.spreadBps.toFixed(2)} bps.`
    : best
      ? `${best.cfdSymbol} sigue siendo fuerte, pero ya existe exposicion en ese simbolo; no duplicar es parte del edge.`
      : 'No hay entrada fresca superior al portafolio actual.'

  const surpriseMove = mode === 'ROTATING'
    ? `Cerrar ${weakest?.cfdSymbol} si sigue negativo y liberar margen para ${freshBest?.cfdSymbol}; no esperar por orgullo a que una posicion floja vuelva.`
    : mode === 'HUNTING'
      ? `Priorizar la entrada con menor movimiento minimo hacia $2, no la que tenga el grafico mas llamativo.`
      : mode === 'MANAGING'
        ? `Bajar el churn: una posicion solo se corta por stale si supera ${minimumRotationHoldMinutes().toFixed(0)}m y la perdida es significativa.`
        : mode === 'DEFENSIVE'
          ? 'No perseguir oportunidades: primero recuperar margin level y free margin.'
          : 'Esperar 10 cierres antes de creerle a cualquier metrica bonita.'

  const tacticalPlan = [
    freshBest && slotsAvailable > 0 && !marginTight ? `Intentar nueva entrada paper en ${freshBest.cfdSymbol} si pasa CFD Skill y no duplica simbolo.` : 'No abrir por abrir: solo entradas con target neto $2 matematicamente alcanzable.',
    weakest ? `Vigilar ${weakest.cfdSymbol}: P/L ${weakest.openPnl.toFixed(4)}, edad ${ageMinutes(weakest).toFixed(1)}m.` : 'Sin posicion debil clara.',
    `Mantener margen: minimo observado ${input.effectiveness.minMarginLevel.toFixed(0)}%, free margin minimo $${input.effectiveness.minFreeMargin.toFixed(2)}.`,
  ]
  const riskWatched = weakest?.cfdSymbol ?? null
  const suggestedActions: TraderSkillAction[] = []
  const executableActions: TraderSkillAction[] = []

  if (riskWatched) {
    suggestedActions.push({ type: 'WATCH_RISK_POSITION', symbol: riskWatched, reason: `Vigilar ${riskWatched}: es la posicion menos eficiente del portafolio.` })
    executableActions.push({ type: 'WATCH_RISK_POSITION', symbol: riskWatched, reason: `Marcar ${riskWatched} como riesgo observado.` })
  }

  const staleNegative = weakest && weakest.openPnl <= -1 && ageMinutes(weakest) >= minimumRotationHoldMinutes()
  if (staleNegative) {
    suggestedActions.push({ type: 'CLOSE_STALE_NEGATIVE_POSITION', symbol: weakest.cfdSymbol, reason: `${weakest.cfdSymbol} supero ${minimumRotationHoldMinutes().toFixed(0)}m, sigue con perdida significativa y no demuestra avance hacia $2.` })
    executableActions.push({ type: 'CLOSE_STALE_NEGATIVE_POSITION', symbol: weakest.cfdSymbol, reason: 'Cerrar paper si feed y guardianes permiten salida con precio valido.' })
  }

  if (mode === 'ROTATING' && freshBest && weakest) {
    suggestedActions.push({ type: 'ROTATE_CAPITAL', symbol: freshBest.cfdSymbol, reason: `Rotar desde ${weakest.cfdSymbol} hacia ${freshBest.cfdSymbol}.` })
    if (confidence === 'HIGH' || staleNegative) {
      executableActions.push({ type: 'ROTATE_CAPITAL', symbol: freshBest.cfdSymbol, reason: `La nueva oportunidad supera a la posicion debil y libera capital paper.` })
    }
  }

  if (mode === 'DEFENSIVE') {
    suggestedActions.push({ type: 'BLOCK_NEW_ENTRIES', reason: 'Modo defensivo: proteger margen antes de abrir nuevas entradas.' })
    executableActions.push({ type: 'BLOCK_NEW_ENTRIES', reason: 'Bloquear nuevas entradas por lectura defensiva del trader skill.' })
  }

  if (mode === 'MEASURING') {
    suggestedActions.push({ type: 'BLOCK_WEAK_ENTRY', reason: 'Muestra insuficiente: no escalar entradas debiles hasta tener cierres medibles.' })
  }

  if (input.positions.some((position) => position.openPnl > 0)) {
    suggestedActions.push({ type: 'HOLD_WINNERS', reason: 'Dejar correr posiciones positivas mientras mantengan tesis y no devuelvan el avance.' })
    executableActions.push({ type: 'HOLD_WINNERS', reason: 'Mantener ganadoras; no cerrar antes del target neto.' })
  }

  if (!executableActions.length) {
    executableActions.push({ type: 'MANAGE_REVIEW', reason: 'Revisar portafolio y mantener si no hay señal accionable.' })
  }

  const readout: CfdTraderSkillReadout = {
    actionsTaken: input.actionsTaken ?? [],
    blockedActions: input.blockedActions ?? [],
    confidence,
    changeOfMindTrigger: 'Spread ampliado, margin level bajo 115%, target neto alcanzado, o feed no confiable.',
    executableActions,
    headline,
    mode,
    reading: headline,
    riskWarning: marginTight
      ? 'Margen justo: bloquear crecimiento hasta recuperar aire.'
      : 'Riesgo controlado: no hay ejecucion real y el margen paper sigue vigilado.',
    riskWatched,
    strongestOpportunity: freshBest ? {
      cfdSymbol: freshBest.cfdSymbol,
      expectedNetProfit: freshBest.expectedNetProfit ?? 0,
      reason: freshBest.reason,
      score: freshBest.cfdExpertScore ?? freshBest.opportunityScore,
      spreadBps: freshBest.quote.spreadBps,
    } : null,
    suggestedActions,
    surpriseMove,
    surprisePlay: surpriseMove,
    tacticalPlan,
    tacticalPlanText: tacticalPlan.join(' '),
    thesis,
    weakestPosition: weakest ? {
      ageMinutes: Number(ageMinutes(weakest).toFixed(1)),
      cfdSymbol: weakest.cfdSymbol,
      openPnl: Number(weakest.openPnl.toFixed(4)),
      reason: weakest.openPnl < 0 ? 'Negativa y candidata a rotacion si no mejora.' : 'Es la menos eficiente relativa al resto.',
    } : null,
    whatWouldChangeMind: 'Cambiar de idea si el spread se amplia, el margin level cae bajo 115%, o una posicion alcanza el target neto antes de rotar.',
  }

  return readout
}
