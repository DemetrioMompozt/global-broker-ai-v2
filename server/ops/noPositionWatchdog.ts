import { tradingConfig } from '../config/tradingConfig.js'
import type { AccountSnapshot } from '../risk/accountHealthGuard.js'
import type { CfdPosition } from '../storage/tradeStore.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'

export type NoPositionWatchdogStatus = {
  active: boolean
  action: 'OPEN_CONTROLLED_PROBE' | 'WAIT_FOR_CAPACITY' | 'WAIT_FOR_FEED' | 'WAIT_FOR_AUDIT' | 'OBSERVE'
  candidateSymbol: string | null
  requiredIdleSeconds: number
  secondsSinceLastOpen: number
  status: 'ARMED' | 'TRIGGERED' | 'BLOCKED' | 'OBSERVING'
  reason: string
}

function hasLiveFeed(opportunity: Opportunity) {
  return ['BROKER_DEMO_REALTIME', 'REALTIME_TICK'].includes(opportunity.quote.feedType)
    && Number.isFinite(opportunity.quote.bid)
    && Number.isFinite(opportunity.quote.ask)
    && opportunity.quote.bid > 0
    && opportunity.quote.ask > opportunity.quote.bid
}

function isUsableCandidate(opportunity: Opportunity, openPositions: CfdPosition[]) {
  if (openPositions.some((position) => position.cfdSymbol === opportunity.cfdSymbol)) return false
  if (!hasLiveFeed(opportunity)) return false
  if (opportunity.setupStatus === 'CANDLE_BLOCKED') return false
  if ((opportunity.candleBehavior as { signal?: string } | undefined)?.signal === 'BLOCKS_ENTRY') return false
  if ((opportunity.expectedNetProfit ?? 0) < 1.75) return false
  return (opportunity.opportunityScore ?? 0) >= 76 && (opportunity.cfdExpertScore ?? 0) >= 72
}

export function buildNoPositionWatchdog(input: {
  account: AccountSnapshot
  auditGrade: 'PROFESSIONAL_READY' | 'DEGRADED' | 'BLOCKED'
  lastPositionOpenedAt: string | null
  now?: number
  openPositions: CfdPosition[]
  opportunities: Opportunity[]
}) : NoPositionWatchdogStatus {
  const requiredIdleSeconds = Number(process.env.NO_POSITION_WATCHDOG_SECONDS ?? 120)
  const now = input.now ?? Date.now()
  const lastOpenMs = input.lastPositionOpenedAt ? new Date(input.lastPositionOpenedAt).getTime() : now - requiredIdleSeconds * 1_000
  const secondsSinceLastOpen = Math.max(0, (now - lastOpenMs) / 1_000)
  const hasCapacity = input.openPositions.length < tradingConfig.maxOpenPositions
  const marginOk = input.account.marginLevel >= 120 && input.account.freeMargin >= input.account.equity * 0.08
  const candidate = input.opportunities.find((opportunity) => isUsableCandidate(opportunity, input.openPositions)) ?? null

  if (input.auditGrade === 'BLOCKED') {
    return {
      active: false,
      action: 'WAIT_FOR_AUDIT',
      candidateSymbol: candidate?.cfdSymbol ?? null,
      reason: 'Auditoria profesional bloquea nuevas entradas; primero corregir integridad/safety/worker.',
      requiredIdleSeconds,
      secondsSinceLastOpen,
      status: 'BLOCKED',
    }
  }
  if (!hasCapacity || !marginOk) {
    return {
      active: false,
      action: 'WAIT_FOR_CAPACITY',
      candidateSymbol: candidate?.cfdSymbol ?? null,
      reason: !hasCapacity
        ? `Sin cupos: ${input.openPositions.length}/${tradingConfig.maxOpenPositions} posiciones abiertas.`
        : `Margen insuficiente para forzar actividad: level ${input.account.marginLevel.toFixed(0)}%, free ${input.account.freeMargin.toFixed(2)}.`,
      requiredIdleSeconds,
      secondsSinceLastOpen,
      status: 'BLOCKED',
    }
  }
  if (!candidate) {
    return {
      active: false,
      action: 'WAIT_FOR_FEED',
      candidateSymbol: null,
      reason: 'No hay candidato con feed vivo, costo razonable y vela no bloqueante.',
      requiredIdleSeconds,
      secondsSinceLastOpen,
      status: secondsSinceLastOpen >= requiredIdleSeconds ? 'ARMED' : 'OBSERVING',
    }
  }
  if (secondsSinceLastOpen < requiredIdleSeconds) {
    return {
      active: false,
      action: 'OBSERVE',
      candidateSymbol: candidate.cfdSymbol,
      reason: `Watchdog observando. Si no abre nueva posicion en ${(requiredIdleSeconds - secondsSinceLastOpen).toFixed(0)}s, presiona entrada controlada.`,
      requiredIdleSeconds,
      secondsSinceLastOpen,
      status: 'OBSERVING',
    }
  }
  return {
    active: true,
    action: 'OPEN_CONTROLLED_PROBE',
    candidateSymbol: candidate.cfdSymbol,
    reason: `Mas de ${requiredIdleSeconds}s sin posicion nueva; activar entrada paper controlada en el mejor candidato vivo.`,
    requiredIdleSeconds,
    secondsSinceLastOpen,
    status: 'TRIGGERED',
  }
}
