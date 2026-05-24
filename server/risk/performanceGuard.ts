import { getClosedTrades } from '../storage/tradeStore.js'
import { microProfitConfig } from '../config/microProfitConfig.js'

export function getPerformanceGuardStatus() {
  const trades = getClosedTrades()
  if (trades.length < 20) return { status: 'APPROVED' as const, reason: 'Muestra insuficiente para bloquear por PF; paper mode continua con riesgo bajo.' }
  const grossProfit = trades.filter((trade) => trade.pnl > 0).reduce((sum, trade) => sum + trade.pnl, 0)
  const grossLoss = Math.abs(trades.filter((trade) => trade.pnl < 0).reduce((sum, trade) => sum + trade.pnl, 0))
  const netPnl = grossProfit - grossLoss
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0
  if (profitFactor < 1 && netPnl > -microProfitConfig.dailyStopLossUsd) {
    return {
      status: 'APPROVED' as const,
      reason: `PF ${profitFactor.toFixed(2)} debil, pero perdida neta $${Math.abs(netPnl).toFixed(2)} sigue dentro del presupuesto demo. Continuar con filtro direccional y stop de perdida.`,
    }
  }
  if (profitFactor < 1) {
    return {
      status: 'APPROVED' as const,
      reason: `PF ${profitFactor.toFixed(2)} menor a 1.0 y perdida demo $${Math.abs(netPnl).toFixed(2)}. Modo paper nunca se apaga: continuar solo con probes controlados, watchdog y aprendizaje; sin dinero real.`,
    }
  }
  return { status: 'APPROVED' as const, reason: `PF ${profitFactor.toFixed(2)} permitido.` }
}
