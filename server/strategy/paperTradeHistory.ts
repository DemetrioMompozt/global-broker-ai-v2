import type { ClosedTrade } from '../storage/tradeStore.js'
import type { V4PaperTrade } from './paperTradeLifecycle.js'

export type PaperTradeHistoryItem = {
  closeReason: string | null
  closedAt: string | null
  durationSeconds: number | null
  entryPrice: number
  exitPrice: number | null
  id: string
  moveRatioAtEntry: number | null
  openedAt: string
  pnlUsd: number | null
  scoreAtEntry: number | null
  side: 'BUY' | 'SELL'
  source: 'V4_DEMO' | 'CFD_PAPER_JOURNAL'
  status: 'OPEN' | 'CLOSED'
  stopUsd: number | null
  strategy: string | null
  symbol: string
  targetUsd: number | null
  technicalClosure: boolean
}

export type PaperTradeHistoryStatus = {
  generatedAt: string
  items: PaperTradeHistoryItem[]
  summary: {
    closed: number
    journalTrades: number
    open: number
    strategic: number
    technical: number
    total: number
    v4Trades: number
  }
}

const technicalReasons = new Set([
  'INVALID_FEED',
  'DATA_TIMEOUT',
  'FEED_UNAVAILABLE',
  'PRICE_NOT_VALID',
  'PROVIDER_DISCONNECTED',
  'SAFETY_HALT',
])

function durationSeconds(openedAt: string, closedAt: string | null) {
  if (!closedAt) return null
  const opened = Date.parse(openedAt)
  const closed = Date.parse(closedAt)
  if (!Number.isFinite(opened) || !Number.isFinite(closed)) return null
  return Math.max(0, Math.round((closed - opened) / 1000))
}

function fromV4(trade: V4PaperTrade): PaperTradeHistoryItem {
  return {
    closeReason: trade.closeReason,
    closedAt: trade.closedAt,
    durationSeconds: durationSeconds(trade.openedAt, trade.closedAt),
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    id: `v4:${trade.id}`,
    moveRatioAtEntry: trade.moveRatioAtEntry,
    openedAt: trade.openedAt,
    pnlUsd: trade.pnlUsd,
    scoreAtEntry: trade.scoreAtEntry,
    side: trade.side,
    source: 'V4_DEMO',
    status: trade.status,
    stopUsd: trade.stopUsd,
    strategy: null,
    symbol: trade.symbol,
    targetUsd: trade.targetUsd,
    technicalClosure: trade.closeReason ? technicalReasons.has(trade.closeReason) : false,
  }
}

function fromJournal(trade: ClosedTrade): PaperTradeHistoryItem {
  return {
    closeReason: trade.exitReason,
    closedAt: trade.closedAt,
    durationSeconds: durationSeconds(trade.openedAt, trade.closedAt),
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    id: `journal:${trade.id}:${trade.closedAt}`,
    moveRatioAtEntry: trade.minimumMoveBps ? Math.abs(trade.minimumMoveBps) : null,
    openedAt: trade.openedAt,
    pnlUsd: trade.netPnl ?? trade.pnl,
    scoreAtEntry: trade.cfdExpertScore,
    side: trade.direction === 'LONG' ? 'BUY' : 'SELL',
    source: 'CFD_PAPER_JOURNAL',
    status: 'CLOSED',
    stopUsd: trade.riskUsd,
    strategy: trade.strategy,
    symbol: trade.cfdSymbol,
    targetUsd: trade.microTargetNetUsd ?? null,
    technicalClosure: technicalReasons.has(trade.exitReason),
  }
}

export function buildPaperTradeHistory(input: {
  cfdClosedTrades: ClosedTrade[]
  limit?: number
  now?: Date
  v4Trades: V4PaperTrade[]
}): PaperTradeHistoryStatus {
  const v4Items = input.v4Trades.map(fromV4)
  const journalItems = input.cfdClosedTrades.map(fromJournal)
  const seen = new Set<string>()
  const items = [...v4Items, ...journalItems]
    .filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    .sort((left, right) => Date.parse(right.closedAt ?? right.openedAt) - Date.parse(left.closedAt ?? left.openedAt))
    .slice(0, input.limit ?? 120)
  const closed = items.filter((item) => item.status === 'CLOSED')
  const technical = closed.filter((item) => item.technicalClosure).length

  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    items,
    summary: {
      closed: closed.length,
      journalTrades: journalItems.length,
      open: items.filter((item) => item.status === 'OPEN').length,
      strategic: closed.length - technical,
      technical,
      total: items.length,
      v4Trades: v4Items.length,
    },
  }
}
