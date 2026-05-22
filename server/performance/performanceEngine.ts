import { getClosedTrades } from '../storage/tradeStore.js'
import { evaluateSampleSize } from '../risk/sampleSizeGuard.js'

export function getPerformanceSummary() {
  const trades = getClosedTrades()
  const sample = evaluateSampleSize()
  const grossProfit = trades.filter((trade) => trade.pnl > 0).reduce((sum, trade) => sum + trade.pnl, 0)
  const grossLoss = Math.abs(trades.filter((trade) => trade.pnl < 0).reduce((sum, trade) => sum + trade.pnl, 0))
  const netProfit = grossProfit - grossLoss
  const wins = trades.filter((trade) => trade.pnl > 0).length
  return {
    trades: trades.length,
    grossProfit,
    grossLoss,
    netProfit,
    profitFactor: sample.insufficientSample ? 0 : grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0,
    profitFactorDisplay: sample.insufficientSample ? sample.displayProfitFactorAs : (grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? '999.00' : '0.00'),
    sampleSizeStatus: sample.insufficientSample ? 'INSUFFICIENT_SAMPLE' : 'SUFFICIENT_SAMPLE',
    sampleSizeReason: sample.reason,
    winRate: trades.length ? wins / trades.length * 100 : 0,
    expectedPayoff: trades.length ? netProfit / trades.length : 0,
    drawdown: 0,
    recoveryFactor: 0,
  }
}
