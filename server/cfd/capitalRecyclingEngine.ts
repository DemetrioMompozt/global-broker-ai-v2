import type { RotationDecision } from './positionRotationEngine.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'

export function evaluateCapitalRecycling(input: {
  bestOpportunity: Opportunity | null
  costToSwitch: number
  weakestPosition: RotationDecision | null
}) {
  if (!input.bestOpportunity || !input.weakestPosition) {
    return { approved: false, reason: 'Sin oportunidad nueva o sin posicion candidata para reciclar.' }
  }
  const newScore = input.bestOpportunity.cfdExpertScore ?? input.bestOpportunity.opportunityScore
  const oldScore = input.weakestPosition.positionQualityScore
  const expectedNetProfit = input.bestOpportunity.expectedNetProfit ?? 0
  const ageMinutes = Math.max(0, (Date.now() - new Date(input.weakestPosition.position.openedAt).getTime()) / 60_000)
  const lossIsMeaningful = input.weakestPosition.position.openPnl <= -1
  const oldPositionIsMature = ageMinutes >= 30
  const improvesScore = newScore >= oldScore + 25
  const switchCostOk = expectedNetProfit > 0 && input.costToSwitch <= expectedNetProfit * 0.1
  const approved = improvesScore && switchCostOk && lossIsMeaningful && oldPositionIsMature
  return {
    approved,
    reason: approved
      ? `Reciclaje aprobado: oportunidad ${input.bestOpportunity.cfdSymbol} mejora score ${newScore.toFixed(0)} vs ${oldScore.toFixed(0)}.`
      : `No reciclar: se evita churn. Requiere edad >=30m, perdida <=-$1, mejora +25 y costo <=10% del beneficio. Nuevo score ${newScore.toFixed(0)}, actual ${oldScore.toFixed(0)}, edad ${ageMinutes.toFixed(1)}m.`,
  }
}
