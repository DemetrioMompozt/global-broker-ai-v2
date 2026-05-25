import { tradingConfig } from '../config/tradingConfig.js'
import { getClosedTrades, type CfdPosition } from '../storage/tradeStore.js'
import type { AccountSnapshot } from '../risk/accountHealthGuard.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'

export type ProfitCadenceWatchdogStatus = {
  active: boolean
  action: 'ESCALATE_CONTROLLED_SCOUT' | 'WAIT_FOR_CAPACITY' | 'WAIT_FOR_CANDIDATE' | 'OBSERVE'
  candidateSymbol: string | null
  requiredSecondsWithoutTarget: number
  secondsSinceLastTarget: number
  status: 'TRIGGERED' | 'BLOCKED' | 'OBSERVING'
  reason: string
}

function targetWindowSeconds() {
  return Math.max(60, Number(process.env.PROFIT_CADENCE_TARGET_SECONDS ?? 600))
}

function hasLiveFeed(opportunity: Opportunity) {
  return ['BROKER_DEMO_REALTIME', 'REALTIME_TICK'].includes(opportunity.quote.feedType)
    && Number.isFinite(opportunity.quote.bid)
    && Number.isFinite(opportunity.quote.ask)
    && opportunity.quote.bid > 0
    && opportunity.quote.ask > opportunity.quote.bid
}

function candleSignal(opportunity: Opportunity) {
  const candle = opportunity.candleBehavior
  if (typeof candle === 'object' && candle && 'signal' in candle && typeof candle.signal === 'string') return candle.signal
  return null
}

function usableCandidate(opportunity: Opportunity, openPositions: CfdPosition[]) {
  if (openPositions.some((position) => position.cfdSymbol === opportunity.cfdSymbol)) return false
  if (!hasLiveFeed(opportunity)) return false
  if (opportunity.setupStatus === 'CANDLE_BLOCKED') return false
  if (candleSignal(opportunity) === 'BLOCKS_ENTRY') return false
  if ((opportunity.expectedNetProfit ?? 0) < 1.4) return false
  return (opportunity.opportunityScore ?? 0) >= 70 && (opportunity.cfdExpertScore ?? 0) >= 65
}

function latestTargetHitAt() {
  const today = new Date().toISOString().slice(0, 10)
  const targetHits = getClosedTrades()
    .filter((trade) => trade.closedAt.startsWith(today) && trade.exitReason === 'MICRO_CLOSE_TARGET')
    .sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
  return targetHits[0]?.closedAt ?? null
}

export function buildProfitCadenceWatchdog(input: {
  account: AccountSnapshot
  openPositions: CfdPosition[]
  opportunities: Opportunity[]
  now?: number
}): ProfitCadenceWatchdogStatus {
  const requiredSecondsWithoutTarget = targetWindowSeconds()
  const now = input.now ?? Date.now()
  const lastTarget = latestTargetHitAt()
  const lastTargetMs = lastTarget ? new Date(lastTarget).getTime() : now - requiredSecondsWithoutTarget * 1000
  const secondsSinceLastTarget = Math.max(0, (now - lastTargetMs) / 1000)
  const hasCapacity = input.openPositions.length < tradingConfig.maxOpenPositions
  const marginOk = input.account.marginLevel >= 130 && input.account.freeMargin >= input.account.equity * 0.08
  const candidate = input.opportunities.find((opportunity) => usableCandidate(opportunity, input.openPositions)) ?? null

  if (!hasCapacity || !marginOk) {
    return {
      active: false,
      action: 'WAIT_FOR_CAPACITY',
      candidateSymbol: candidate?.cfdSymbol ?? null,
      reason: !hasCapacity
        ? `Sin cupos para buscar target: ${input.openPositions.length}/${tradingConfig.maxOpenPositions} posiciones abiertas.`
        : `No se escala por margen: level ${input.account.marginLevel.toFixed(0)}%, free $${input.account.freeMargin.toFixed(2)}.`,
      requiredSecondsWithoutTarget,
      secondsSinceLastTarget,
      status: 'BLOCKED',
    }
  }

  if (!candidate) {
    return {
      active: false,
      action: 'WAIT_FOR_CANDIDATE',
      candidateSymbol: null,
      reason: 'Cadencia activa, pero no hay candidato con feed vivo, costo aceptable y vela no bloqueante.',
      requiredSecondsWithoutTarget,
      secondsSinceLastTarget,
      status: 'BLOCKED',
    }
  }

  if (secondsSinceLastTarget < requiredSecondsWithoutTarget) {
    return {
      active: false,
      action: 'OBSERVE',
      candidateSymbol: candidate.cfdSymbol,
      reason: `Cadencia observando: quedan ${(requiredSecondsWithoutTarget - secondsSinceLastTarget).toFixed(0)}s antes de escalar scouts por falta de target $2.`,
      requiredSecondsWithoutTarget,
      secondsSinceLastTarget,
      status: 'OBSERVING',
    }
  }

  return {
    active: true,
    action: 'ESCALATE_CONTROLLED_SCOUT',
    candidateSymbol: candidate.cfdSymbol,
    reason: `Sin target $2 durante ${requiredSecondsWithoutTarget}s; escalar scout paper controlado en ${candidate.cfdSymbol}.`,
    requiredSecondsWithoutTarget,
    secondsSinceLastTarget,
    status: 'TRIGGERED',
  }
}
