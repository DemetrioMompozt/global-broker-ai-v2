import { getClosedTrades, type ClosedTrade } from '../storage/tradeStore.js'

export type SymbolDiagnostic = {
  avgLoss: number
  avgWin: number
  costToProfitRatio: number
  grossLoss: number
  grossProfit: number
  maxDrawdown: number
  netPnl: number
  profitFactor: number | null
  spreadAvg: number
  status: 'KEEP' | 'WATCH' | 'SUSPEND' | 'BAN_FOR_SESSION'
  symbol: string
  trades: number
  winRate: number
}

function todayTrades() {
  const today = new Date().toISOString().slice(0, 10)
  return getClosedTrades().filter((trade) => trade.closedAt.startsWith(today))
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const value = key(item)
    groups.set(value, [...(groups.get(value) ?? []), item])
  }
  return groups
}

function profitFactor(trades: ClosedTrade[]) {
  const grossProfit = trades.filter((trade) => trade.pnl > 0).reduce((sum, trade) => sum + trade.pnl, 0)
  const grossLoss = Math.abs(trades.filter((trade) => trade.pnl < 0).reduce((sum, trade) => sum + trade.pnl, 0))
  if (grossLoss > 0) return grossProfit / grossLoss
  return grossProfit > 0 ? null : 0
}

function consecutiveLosses(trades: ClosedTrade[]) {
  let losses = 0
  for (const trade of trades) {
    if (trade.pnl < 0) losses += 1
    else break
  }
  return losses
}

function symbolDiagnostic(symbol: string, trades: ClosedTrade[]): SymbolDiagnostic {
  const wins = trades.filter((trade) => trade.pnl > 0)
  const losses = trades.filter((trade) => trade.pnl < 0)
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0))
  const netPnl = grossProfit - grossLoss
  const pf = profitFactor(trades)
  const avgWin = wins.length ? grossProfit / wins.length : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0
  const spreadAvg = trades.length ? trades.reduce((sum, trade) => sum + Math.abs(trade.spreadAtEntry ?? 0), 0) / trades.length : 0
  const costToProfitRatio = trades.length ? trades.reduce((sum, trade) => sum + (trade.costToProfitRatio ?? 0), 0) / trades.length : 0
  let running = 0
  let peak = 0
  let maxDrawdown = 0
  for (const trade of [...trades].reverse()) {
    running += trade.pnl
    peak = Math.max(peak, running)
    maxDrawdown = Math.max(maxDrawdown, peak - running)
  }
  const status = consecutiveLosses(trades) >= 3
    ? 'BAN_FOR_SESSION'
    : netPnl < 0 && (pf ?? 0) < 1
      ? 'SUSPEND'
      : costToProfitRatio > 0.3
        ? 'SUSPEND'
        : netPnl <= 0
          ? 'WATCH'
          : 'KEEP'
  return {
    avgLoss: Number(avgLoss.toFixed(4)),
    avgWin: Number(avgWin.toFixed(4)),
    costToProfitRatio: Number(costToProfitRatio.toFixed(4)),
    grossLoss: Number(grossLoss.toFixed(4)),
    grossProfit: Number(grossProfit.toFixed(4)),
    maxDrawdown: Number(maxDrawdown.toFixed(4)),
    netPnl: Number(netPnl.toFixed(4)),
    profitFactor: pf === null ? null : Number(pf.toFixed(4)),
    spreadAvg: Number(spreadAvg.toFixed(6)),
    status,
    symbol,
    trades: trades.length,
    winRate: Number((trades.length ? wins.length / trades.length * 100 : 0).toFixed(2)),
  }
}

function worstGroup(trades: ClosedTrade[], key: (trade: ClosedTrade) => string) {
  return [...groupBy(trades, key).entries()]
    .map(([name, items]) => ({ name, netPnl: Number(items.reduce((sum, trade) => sum + trade.pnl, 0).toFixed(4)), trades: items.length }))
    .sort((a, b) => a.netPnl - b.netPnl)
}

export function buildLossAttribution() {
  const trades = todayTrades()
  const diagnostics = [...groupBy(trades, (trade) => trade.cfdSymbol).entries()]
    .map(([symbol, items]) => symbolDiagnostic(symbol, items))
    .sort((a, b) => a.netPnl - b.netPnl)
  const losing = trades.filter((trade) => trade.pnl < 0)
  const costImpact = Number(trades.reduce((sum, trade) => sum + (trade.totalEstimatedCost ?? 0), 0).toFixed(4))
  const leverageImpact = Number(losing.reduce((sum, trade) => sum + Math.max(0, (trade.leverage ?? 1) - 1) * Math.abs(trade.pnl), 0).toFixed(4))
  const correlationImpact = Number(losing.filter((trade) => ['NAS100.cfd', 'US500.cfd', 'EURUSD.cfd', 'GBPUSD.cfd'].includes(trade.cfdSymbol)).reduce((sum, trade) => sum + Math.abs(trade.pnl), 0).toFixed(4))
  const closureReasons = worstGroup(losing, (trade) => trade.exitReason)
  const mainLossDriver = closureReasons[0]?.name === 'THESIS_LOST_NO_EDGE' || closureReasons[0]?.name === 'THESIS_INVALIDATED'
    ? 'bad_entries'
    : costImpact > Math.abs(trades.reduce((sum, trade) => sum + trade.pnl, 0)) && trades.length
      ? 'target_too_small'
      : leverageImpact > 10
        ? 'leverage'
        : correlationImpact > 4
          ? 'correlation'
          : losing.length
            ? 'weak_setup'
            : 'unknown'
  const recommendations = [
    'Mantener DEFENSIVE_DIAGNOSTIC_MODE activo: no abrir nuevas posiciones.',
    'Suspender simbolos con PF < 1 o tres perdidas consecutivas durante la sesion.',
    'Reactivar con risk $10 solo en modo prueba controlada: max 2 posiciones, leverage maximo 10x y gate anti-perdida por simbolo.',
  ]
  if (mainLossDriver === 'target_too_small') recommendations.push('Revisar target $2: costos/spread estan consumiendo demasiado del objetivo.')
  if (mainLossDriver === 'leverage') recommendations.push('Reducir leverage paper: 25x amplifica ruido y drawdown.')
  if (mainLossDriver === 'bad_entries') recommendations.push('Endurecer entrada: exigir edge persistente y no operar setup que pierda tesis rapido.')
  return {
    correlationImpact,
    costImpact,
    leverageImpact,
    mainLossDriver,
    recommendations,
    symbolDiagnostics: diagnostics,
    worstDirections: worstGroup(losing, (trade) => trade.direction),
    worstStrategies: worstGroup(losing, (trade) => trade.strategy),
    worstSymbols: diagnostics.filter((item) => item.netPnl < 0).slice(0, 5),
  }
}
