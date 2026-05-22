import { getClosedTrades, getOpenPositions } from '../storage/tradeStore.js'

export function buildLeverageDamage() {
  const today = new Date().toISOString().slice(0, 10)
  const trades = getClosedTrades().filter((trade) => trade.closedAt.startsWith(today))
  const open = getOpenPositions()
  const negativeTrades = trades.filter((trade) => trade.pnl < 0)
  const averageLeverage = [...trades, ...open].length
    ? [...trades, ...open].reduce((sum, item) => sum + (item.leverage ?? 1), 0) / [...trades, ...open].length
    : 0
  const leveragedLoss = negativeTrades.reduce((sum, trade) => sum + Math.abs(trade.pnl) * Math.max(0, (trade.leverage ?? 1) - 1), 0)
  const marginStressClosures = trades.filter((trade) => ['POSITION_CLOSE_WEAK', 'CAPITAL_RECYCLE', 'MICRO_MAX_LOSS'].includes(trade.exitReason)).length
  const recommendation = trades.reduce((sum, trade) => sum + trade.pnl, 0) < 0
    ? 'Reducir leverage paper a 1x-2x antes de reactivar.'
    : averageLeverage > 10
      ? 'Leverage alto: mantener diagnostico hasta confirmar edge.'
      : 'Leverage no es concluyente con la muestra actual.'
  return {
    averageLeverage: Number(averageLeverage.toFixed(2)),
    drawdownAmplified: leveragedLoss > 0,
    leveragedLossImpact: Number(leveragedLoss.toFixed(4)),
    marginStressClosures,
    recommendation,
  }
}
