import type { AccountSnapshot } from '../risk/accountHealthGuard.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'
import type { CfdPosition } from '../storage/tradeStore.js'
import { microProfitConfig } from '../config/microProfitConfig.js'

export type RotationDecision = {
  action: 'HOLD' | 'CLOSE' | 'REDUCE' | 'REPLACE' | 'WAIT'
  capitalEfficiencyScore: number
  marginEfficiencyScore: number
  position: CfdPosition
  positionQualityScore: number
  reason: string
}

function ageSeconds(position: CfdPosition) {
  return Math.max(0, (Date.now() - new Date(position.openedAt).getTime()) / 1000)
}

export function minimumRotationHoldSeconds() {
  return Math.max(120, microProfitConfig.maxHoldSeconds * 0.4)
}

function scorePosition(position: CfdPosition, account: AccountSnapshot) {
  const pnlScore = Math.max(0, Math.min(35, 20 + position.openPnl * 6))
  const marginShare = account.equity > 0 ? position.marginRequired / account.equity : 1
  const marginEfficiencyScore = Math.max(0, Math.min(30, 30 - marginShare * 60))
  const agePenalty = ageSeconds(position) > minimumRotationHoldSeconds() && position.openPnl <= 0 ? 15 : 0
  const expertScore = Math.max(0, Math.min(25, position.cfdExpertScore / 4))
  const movementScore = position.openPnl >= 0 ? 10 : 2
  const positionQualityScore = Math.max(0, Math.min(100, pnlScore + marginEfficiencyScore + expertScore + movementScore - agePenalty))
  const capitalEfficiencyScore = Math.max(0, Math.min(100, positionQualityScore - marginShare * 35))
  return {
    capitalEfficiencyScore: Number(capitalEfficiencyScore.toFixed(2)),
    marginEfficiencyScore: Number(marginEfficiencyScore.toFixed(2)),
    positionQualityScore: Number(positionQualityScore.toFixed(2)),
  }
}

export function reviewOpenPositions(input: {
  account: AccountSnapshot
  accountHealth: string
  opportunities: Opportunity[]
  positions: CfdPosition[]
}) {
  const decisions: RotationDecision[] = input.positions.map((position) => {
    const scores = scorePosition(position, input.account)
    const weak = position.openPnl < 0 && scores.positionQualityScore < 65
    const stale = ageSeconds(position) > minimumRotationHoldSeconds()
    const clearlyFailing = position.openPnl <= -Math.min(1, microProfitConfig.maxLossPerTradeUsd * 0.4)
    const highMargin = input.account.equity > 0 && position.marginRequired > input.account.equity * 0.2
    if (input.accountHealth === 'CRITICAL_MARGIN_DEFENSIVE' && (weak || highMargin)) {
      return {
        ...scores,
        action: 'CLOSE' as const,
        position,
        reason: 'Cerrar para liberar margen: free margin negativo y posicion ineficiente.',
      }
    }
    if (input.accountHealth !== 'HEALTHY' && weak && ageSeconds(position) > 120) {
      return {
        ...scores,
        action: 'CLOSE' as const,
        position,
        reason: 'Cerrar posicion debil: P/L negativo, score bajo y cuenta en modo defensivo.',
      }
    }
    if (input.accountHealth === 'HEALTHY' && stale && clearlyFailing && scores.positionQualityScore < 68) {
      return {
        ...scores,
        action: 'REPLACE' as const,
        position,
        reason: 'Rotar posicion estancada: supero el tiempo minimo realista para $2, sigue claramente negativa y no avanza hacia el target neto.',
      }
    }
    return {
      ...scores,
      action: 'HOLD' as const,
      position,
      reason: position.openPnl >= 0 ? 'Mantener: tesis aun viable y P/L no deteriorado.' : 'Mantener bajo observacion: aun no cumple criterio defensivo de cierre.',
    }
  })

  const weakest = [...decisions].sort((a, b) => {
    const margin = b.position.marginRequired - a.position.marginRequired
    if (input.accountHealth === 'CRITICAL_MARGIN_DEFENSIVE' && margin !== 0) return margin
    return a.positionQualityScore - b.positionQualityScore
  })[0] ?? null

  return {
    decisions,
    weakestPosition: weakest,
  }
}
