import { microProfitConfig } from '../config/microProfitConfig.js'
import type { AccountSnapshot } from '../risk/accountHealthGuard.js'
import { getClosedTrades, type CfdPosition, type ClosedTrade } from '../storage/tradeStore.js'

export type AgentEffectivenessStatus = 'MEASURING' | 'EFFECTIVE' | 'WATCH' | 'WEAK' | 'CORRECTIVE' | 'INEFFICIENT'
type EffectivenessActivity = { time: string; action: string; symbol?: string; reason: string; pnl?: number }

let minMarginLevel = Infinity
let minFreeMargin = Infinity

export function observeEffectivenessAccount(account: Pick<AccountSnapshot, 'freeMargin' | 'marginLevel'>) {
  if (Number.isFinite(account.marginLevel)) minMarginLevel = Math.min(minMarginLevel, account.marginLevel)
  if (Number.isFinite(account.freeMargin)) minFreeMargin = Math.min(minFreeMargin, account.freeMargin)
}

function todayTrades() {
  const today = new Date().toISOString().slice(0, 10)
  return getClosedTrades().filter((trade) => trade.closedAt.startsWith(today))
}

function stalePositionSeconds() {
  return Math.max(microProfitConfig.maxHoldSeconds * 6, 30 * 60)
}

function modeReason(items: string[]) {
  if (!items.length) return null
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function closeBucket(trade: ClosedTrade) {
  if (trade.exitReason === 'MICRO_CLOSE_TARGET') return 'target'
  if (trade.exitReason === 'CAPITAL_RECYCLE') return 'rotation'
  if (trade.exitReason === 'POSITION_CLOSE_WEAK') return 'stale'
  if (trade.exitReason === 'STOP_LOSS') return 'loss'
  if (trade.pnl < 0) return 'loss'
  return 'other'
}

export function buildAgentEffectiveness(input: {
  account: AccountSnapshot & { closedPnl?: number }
  activityFeed: EffectivenessActivity[]
  blockedOpportunities: Array<{ cfdSymbol: string; reason: string }>
  openPositions: CfdPosition[]
}) {
  observeEffectivenessAccount(input.account)
  const closedToday = todayTrades()
  const wins = closedToday.filter((trade) => trade.pnl > 0)
  const losses = closedToday.filter((trade) => trade.pnl < 0)
  const targetHits = closedToday.filter((trade) => closeBucket(trade) === 'target')
  const rotations = closedToday.filter((trade) => closeBucket(trade) === 'rotation')
  const staleClosures = closedToday.filter((trade) => closeBucket(trade) === 'stale')
  const lossClosures = closedToday.filter((trade) => closeBucket(trade) === 'loss')
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0))
  const netProfitToday = closedToday.reduce((sum, trade) => sum + trade.pnl, 0)
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0
  const averageNetWin = wins.length ? grossProfit / wins.length : 0
  const averageNetLoss = losses.length ? grossLoss / losses.length : 0
  const expectedPayoff = closedToday.length ? netProfitToday / closedToday.length : 0
  const winRate = closedToday.length ? wins.length / closedToday.length * 100 : 0
  const averageTimeToTargetSeconds = targetHits.length
    ? targetHits.reduce((sum, trade) => sum + Math.max(0, new Date(trade.closedAt).getTime() - new Date(trade.openedAt).getTime()) / 1000, 0) / targetHits.length
    : null
  const stalePositions = input.openPositions.filter((position) => position.openPnl <= -1 && Date.now() - new Date(position.openedAt).getTime() > stalePositionSeconds() * 1000)
  const meaningfulBlocked = input.blockedOpportunities.filter((item) => {
    if (item.reason.includes('MAX_POSITIONS_PER_SYMBOL')) return false
    if (item.reason.includes('Feed VT no disponible') && principalClosureFromTrades() !== 'FEED_ERROR') return false
    return true
  })
  const principalBlockingReason = modeReason(meaningfulBlocked.map((item) => item.reason))
    ?? modeReason(input.activityFeed.filter((item) => item.action.includes('BLOCK') && !item.reason.includes('MAX_POSITIONS_PER_SYMBOL')).map((item) => item.reason))
  const principalClosureReason = principalClosureFromTrades()
  const marginHealthy = input.account.marginLevel >= 200 && input.account.freeMargin > input.account.equity * 0.2
  const rotationChurn = closedToday.length >= 10 && (rotations.length + staleClosures.length) > Math.max(3, targetHits.length * 3)
  let status: AgentEffectivenessStatus = 'MEASURING'
  let reason = 'Midiendo: se necesitan al menos 10 cierres para juzgar efectividad.'

  if (closedToday.length >= 20 && netProfitToday < 0 && (profitFactor ?? 0) < 1 && rotationChurn && marginHealthy) {
    status = 'CORRECTIVE'
    reason = 'Modo correctivo: el problema principal es exceso de rotacion/stale, no margen. El agente debe dejar de reciclar prematuramente y sostener mejores posiciones hacia $2.'
  } else if (closedToday.length >= 20 && netProfitToday < 0 && (profitFactor ?? 0) < 1) {
    status = 'INEFFICIENT'
    reason = 'Ineficiente: despues de 20 cierres, net P/L negativo y Profit Factor menor a 1.0.'
  } else if (closedToday.length >= 10) {
    if ((profitFactor ?? 0) >= 1.3 && expectedPayoff > 0 && netProfitToday > 0 && marginHealthy) {
      status = 'EFFECTIVE'
      reason = 'Efectivo: PF >= 1.3, expected payoff positivo, net P/L positivo y margen sano.'
    } else if ((profitFactor ?? 0) >= 1 && (profitFactor ?? 0) < 1.3 && expectedPayoff >= -0.05) {
      status = 'WATCH'
      reason = 'En observacion: PF entre 1.0 y 1.3 o payoff cerca de cero.'
    } else if ((profitFactor ?? 0) < 1 && expectedPayoff <= 0 && netProfitToday < 0) {
      status = 'WEAK'
      reason = 'Debil: PF menor a 1.0, expected payoff no positivo y net P/L negativo.'
    } else {
      status = 'WATCH'
      reason = 'En observacion: resultados mixtos despues de 10 cierres.'
    }
  }

  const score = Math.max(0, Math.min(100,
    (closedToday.length >= 10 ? 20 : closedToday.length * 2)
    + (netProfitToday > 0 ? 20 : 0)
    + (expectedPayoff > 0 ? 20 : 0)
    + ((profitFactor ?? 0) >= 1.3 ? 20 : (profitFactor ?? 0) >= 1 ? 10 : 0)
    + (marginHealthy ? 20 : 0)
  ))

  return {
    averageNetLoss: Number(averageNetLoss.toFixed(4)),
    averageNetWin: Number(averageNetWin.toFixed(4)),
    averageTimeToTargetSeconds: averageTimeToTargetSeconds === null ? null : Number(averageTimeToTargetSeconds.toFixed(1)),
    closedByLossToday: lossClosures.length,
    closedByRotationToday: rotations.length,
    closedByStaleToday: staleClosures.length,
    closedToday: closedToday.length,
    closedPnl: Number((input.account.closedPnl ?? 0).toFixed(4)),
    expectedPayoff: Number(expectedPayoff.toFixed(4)),
    minFreeMargin: Number((minFreeMargin === Infinity ? input.account.freeMargin : minFreeMargin).toFixed(4)),
    minMarginLevel: Number((minMarginLevel === Infinity ? input.account.marginLevel : minMarginLevel).toFixed(2)),
    netProfitToday: Number(netProfitToday.toFixed(4)),
    openPnl: Number(input.account.openPnl.toFixed(4)),
    openPositions: input.openPositions.length,
    opportunitiesBlocked: input.blockedOpportunities.length,
    principalBlockingReason,
    principalClosureReason,
    profitFactor: profitFactor === null ? null : Number(profitFactor.toFixed(4)),
    profitFactorDisplay: closedToday.length < 10 || profitFactor === null ? 'muestra insuficiente' : profitFactor.toFixed(2),
    reason,
    rotationsToday: rotations.length,
    score: Math.round(score),
    staleClosuresToday: staleClosures.length,
    stalePositions: stalePositions.length,
    status,
    targetHitsToday: targetHits.length,
    winRate: Number(winRate.toFixed(2)),
  }
}

function principalClosureFromTrades() {
  return modeReason(todayTrades().map((trade) => trade.exitReason))
}
