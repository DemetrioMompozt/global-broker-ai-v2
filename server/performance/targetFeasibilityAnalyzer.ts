import { getClosedTrades } from '../storage/tradeStore.js'

export function buildTargetFeasibility() {
  const trades = getClosedTrades().filter((trade) => trade.closedAt.startsWith(new Date().toISOString().slice(0, 10)))
  const targetHits = trades.filter((trade) => trade.exitReason === 'MICRO_CLOSE_TARGET')
  const avgCostRatio = trades.length ? trades.reduce((sum, trade) => sum + (trade.costToProfitRatio ?? 0), 0) / trades.length : 0
  const avgMoveBps = trades.length ? trades.reduce((sum, trade) => sum + (trade.minimumMoveBps ?? 0), 0) / trades.length : 0
  const avgTimeToTargetSeconds = targetHits.length
    ? targetHits.reduce((sum, trade) => sum + Math.max(0, new Date(trade.closedAt).getTime() - new Date(trade.openedAt).getTime()) / 1000, 0) / targetHits.length
    : null
  const targetHitRate = trades.length ? targetHits.length / trades.length : 0
  const viable = trades.length >= 5 && targetHitRate >= 0.45 && avgCostRatio <= 0.3
  const verdict = !trades.length
    ? 'insufficient_data'
    : viable
      ? 'target_2_viable'
      : avgCostRatio > 0.3
        ? 'target_2_too_small_for_costs'
        : targetHitRate < 0.35
          ? 'target_2_not_reached_consistently'
          : 'watch'
  return {
    avgCostToProfitRatio: Number(avgCostRatio.toFixed(4)),
    avgMoveNeededBps: Number(avgMoveBps.toFixed(4)),
    avgTimeToTargetSeconds: avgTimeToTargetSeconds === null ? null : Number(avgTimeToTargetSeconds.toFixed(1)),
    targetHitRate: Number((targetHitRate * 100).toFixed(2)),
    targetNetUsd: 2,
    viable,
    verdict,
  }
}
