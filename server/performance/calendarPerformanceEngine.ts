import { getClosedTrades } from '../storage/tradeStore.js'

export function getCalendarPerformance() {
  const days = new Map<string, { date: string; pnl: number; trades: number }>()
  for (const trade of getClosedTrades()) {
    const date = trade.closedAt.slice(0, 10)
    const current = days.get(date) ?? { date, pnl: 0, trades: 0 }
    current.pnl += trade.pnl
    current.trades += 1
    days.set(date, current)
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date))
}
