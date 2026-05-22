import fs from 'node:fs'
import path from 'node:path'

export type CfdPosition = {
  id: string
  cfdSymbol: string
  underlyingSymbol: string
  source?: 'BINANCE_REALTIME' | 'VT_MARKETS_MT5_DEMO'
  assetClass?: string
  direction: 'LONG' | 'SHORT'
  strategy: string
  entryPrice: number
  currentPrice: number
  currentAsk?: number
  currentBid?: number
  previousPrice: number
  stopLoss: number
  takeProfit: number
  positionSize: number
  riskPercent: number
  riskUsd: number
  marginRequired: number
  leverage: number
  spreadAtEntry: number
  spreadCost?: number
  commission?: number
  slippageEstimate?: number
  swapAccrued?: number
  totalEstimatedCost?: number
  costToProfitRatio?: number
  microTargetNetUsd?: number
  bestOpenPnl?: number
  grossPnl?: number
  netPnl?: number
  openPnl: number
  openPnlPercent: number
  provider: string
  feedType: string
  openedAt: string
  lastBrokerTickTime?: string | null
  lastPriceUpdate: string
  thesis: string
  cfdExpertScore: number
  cfdExpertReason: string
  professionalSkillScore?: number
  professionalSkillReason?: string
  candleBehaviorScoreAtEntry?: number
  candlePatternAtEntry?: string
  minimumMoveNeeded?: number
  minimumMoveBps?: number
  managementStatus: string
  nextAction: string
}

export type ClosedTrade = CfdPosition & {
  exitPrice: number
  exitReason: string
  closedAt: string
  grossPnl?: number
  netPnl?: number
  pnl: number
}

const journalDir = path.join(process.cwd(), 'storage-data')
const journalPath = path.join(journalDir, 'trade-journal.json')
const journalDisabled = process.env.PAPER_TRADE_JOURNAL_DISABLED === 'true'
  || process.argv.some((argument) => argument.includes('/server/tests/') || argument.includes('\\server\\tests\\'))

function loadClosedTrades(): ClosedTrade[] {
  try {
    if (journalDisabled) return []
    if (!fs.existsSync(journalPath)) return []
    const parsed = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as { closedTrades?: ClosedTrade[] }
    return Array.isArray(parsed.closedTrades) ? parsed.closedTrades : []
  } catch {
    return []
  }
}

function persistClosedTrades() {
  try {
    if (journalDisabled) return
    if (!fs.existsSync(journalDir)) fs.mkdirSync(journalDir, { recursive: true })
    fs.writeFileSync(journalPath, JSON.stringify({ closedTrades: closedTrades.slice(0, 500) }, null, 2))
  } catch {
    // Paper journal persistence should never break live status updates.
  }
}

const openPositions: CfdPosition[] = []
const closedTrades: ClosedTrade[] = loadClosedTrades()

export function getOpenPositions() {
  return openPositions
}

export function getClosedTrades() {
  return closedTrades
}

export function addOpenPosition(position: CfdPosition) {
  openPositions.push(position)
}

export function replaceOpenPositions(next: CfdPosition[]) {
  openPositions.splice(0, openPositions.length, ...next)
}

export function closePosition(id: string, exitPrice: number, exitReason: string, pnlOverride?: number, grossPnlOverride?: number) {
  const index = openPositions.findIndex((position) => position.id === id)
  if (index < 0) return null
  const [position] = openPositions.splice(index, 1)
  const grossPnl = grossPnlOverride ?? (position.direction === 'LONG'
    ? (exitPrice - position.entryPrice) * position.positionSize
    : (position.entryPrice - exitPrice) * position.positionSize)
  const pnl = pnlOverride ?? grossPnl
  const closed: ClosedTrade = { ...position, exitPrice, exitReason, closedAt: new Date().toISOString(), grossPnl, netPnl: pnl, pnl }
  closedTrades.unshift(closed)
  persistClosedTrades()
  return closed
}
