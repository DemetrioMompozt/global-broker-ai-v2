import fs from 'node:fs'
import path from 'node:path'
import { validatePaperClosedPnl } from './paperAccountStore.js'

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
const maxExitPriceMoveRatio = Number(process.env.PAPER_MAX_EXIT_PRICE_MOVE_RATIO ?? 0.35)
const journalIntegrity = {
  corruptedTradesRejected: 0,
  lastRepairAt: null as string | null,
  lastBackupPath: null as string | null,
}
const journalDisabled = process.env.PAPER_TRADE_JOURNAL_DISABLED === 'true'
  || process.argv.some((argument) => argument.includes('/server/tests/') || argument.includes('\\server\\tests\\'))

function isFinitePositive(value: number) {
  return Number.isFinite(value) && value > 0
}

function hasImpossibleExitPrice(position: Pick<CfdPosition, 'entryPrice' | 'currentPrice'>, exitPrice: number) {
  if (!isFinitePositive(position.entryPrice) || !isFinitePositive(exitPrice)) return true
  const reference = isFinitePositive(position.currentPrice) ? position.currentPrice : position.entryPrice
  const jumpRatio = Math.abs(exitPrice - reference) / Math.max(reference, 0.000001)
  return jumpRatio > maxExitPriceMoveRatio
}

function validateClosedTradeIntegrity(trade: ClosedTrade) {
  const pnlValidation = validatePaperClosedPnl(trade.pnl)
  if (!pnlValidation.valid) return pnlValidation
  if (!Number.isFinite(trade.grossPnl ?? trade.pnl) || !Number.isFinite(trade.netPnl ?? trade.pnl)) {
    return { valid: false, reason: 'P/L bruto/neto no finito.' }
  }
  if (hasImpossibleExitPrice(trade, trade.exitPrice)) {
    return { valid: false, reason: `Precio de salida fuera de rango paper (${trade.exitPrice}).` }
  }
  return { valid: true, reason: 'Trade cerrado valido.' }
}

function loadClosedTrades(): ClosedTrade[] {
  try {
    if (journalDisabled) return []
    if (!fs.existsSync(journalPath)) return []
    const parsed = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as { closedTrades?: ClosedTrade[] }
    const loaded = Array.isArray(parsed.closedTrades) ? parsed.closedTrades : []
    const safe = loaded.filter((trade) => validateClosedTradeIntegrity(trade).valid)
    if (safe.length !== loaded.length) {
      const backupPath = `${journalPath}.rejected-${Date.now()}.bak`
      fs.copyFileSync(journalPath, backupPath)
      fs.writeFileSync(journalPath, JSON.stringify({ closedTrades: safe.slice(0, 500) }, null, 2))
      journalIntegrity.corruptedTradesRejected += loaded.length - safe.length
      journalIntegrity.lastRepairAt = new Date().toISOString()
      journalIntegrity.lastBackupPath = backupPath
      console.warn(`[PAPER_JOURNAL_GUARD] Rejected ${loaded.length - safe.length} corrupted closed trade(s). Backup: ${backupPath}`)
    }
    return safe
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

export function getTradeJournalIntegrity() {
  return {
    closedTradesLoaded: closedTrades.length,
    corruptedTradesRejected: journalIntegrity.corruptedTradesRejected,
    disabled: journalDisabled,
    journalPath,
    lastBackupPath: journalIntegrity.lastBackupPath,
    lastRepairAt: journalIntegrity.lastRepairAt,
  }
}

export function resetPaperTradeStoreForFreshStart(reason = 'fresh paper start') {
  let backupPath: string | null = null
  try {
    if (!journalDisabled) {
      if (!fs.existsSync(journalDir)) fs.mkdirSync(journalDir, { recursive: true })
      if (fs.existsSync(journalPath)) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-')
        backupPath = `${journalPath}.fresh-start-${stamp}.bak`
        fs.copyFileSync(journalPath, backupPath)
      }
    }
  } catch {
    backupPath = null
  }

  openPositions.splice(0, openPositions.length)
  closedTrades.splice(0, closedTrades.length)
  persistClosedTrades()
  journalIntegrity.lastBackupPath = backupPath
  journalIntegrity.lastRepairAt = new Date().toISOString()

  return {
    backupPath,
    closedTrades: closedTrades.length,
    journalPath,
    openPositions: openPositions.length,
    reason,
  }
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
  const calculatedGrossPnl = grossPnlOverride ?? (position.direction === 'LONG'
    ? (exitPrice - position.entryPrice) * position.positionSize
    : (position.entryPrice - exitPrice) * position.positionSize)
  const calculatedPnl = pnlOverride ?? calculatedGrossPnl
  let safeExitPrice = exitPrice
  let safeGrossPnl = calculatedGrossPnl
  let safePnl = calculatedPnl
  let safeExitReason = exitReason
  const draft: ClosedTrade = {
    ...position,
    exitPrice: safeExitPrice,
    exitReason: safeExitReason,
    closedAt: new Date().toISOString(),
    grossPnl: safeGrossPnl,
    netPnl: safePnl,
    pnl: safePnl,
  }
  const integrity = validateClosedTradeIntegrity(draft)
  if (!integrity.valid) {
    console.warn('[PAPER_TRADE_GUARD] Closed trade P/L rejected:', integrity.reason)
    safeExitPrice = position.currentPrice
    safeGrossPnl = 0
    safePnl = 0
    safeExitReason = `PAPER_PNL_REJECTED_${exitReason}`
  }
  const closed: ClosedTrade = {
    ...position,
    exitPrice: safeExitPrice,
    exitReason: safeExitReason,
    closedAt: new Date().toISOString(),
    grossPnl: safeGrossPnl,
    netPnl: safePnl,
    pnl: safePnl,
  }
  closedTrades.unshift(closed)
  persistClosedTrades()
  return closed
}
