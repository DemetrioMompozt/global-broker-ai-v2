import { tradingConfig } from '../config/tradingConfig.js'

let balance = tradingConfig.initialBalance
const maxClosedPnlApplyUsd = Number(process.env.PAPER_MAX_CLOSED_PNL_APPLY_USD ?? 100)

export function validatePaperClosedPnl(pnl: number) {
  if (!Number.isFinite(pnl)) {
    return { valid: false, reason: 'P/L cerrado no finito.' }
  }
  if (Math.abs(pnl) > maxClosedPnlApplyUsd) {
    return { valid: false, reason: `P/L cerrado fuera de rango paper (${pnl.toFixed(4)}).` }
  }
  return { valid: true, reason: 'P/L cerrado valido.' }
}

export function getPaperAccountBase() {
  return {
    balance,
    closedPnl: balance - tradingConfig.initialBalance,
  }
}

export function applyClosedPnl(pnl: number) {
  const validation = validatePaperClosedPnl(pnl)
  if (!validation.valid) {
    console.warn('[PAPER_ACCOUNT_GUARD] Closed P/L rejected:', validation.reason)
    return {
      applied: false,
      balance,
      closedPnl: balance - tradingConfig.initialBalance,
      reason: validation.reason,
    }
  }
  balance += pnl
  return {
    applied: true,
    balance,
    closedPnl: balance - tradingConfig.initialBalance,
    reason: validation.reason,
  }
}

export function reconcilePaperAccountFromClosedPnl(closedPnl: number) {
  if (!Number.isFinite(closedPnl) || Math.abs(closedPnl) > 1_000) {
    console.warn('[PAPER_ACCOUNT_GUARD] Reconciliation rejected:', closedPnl)
    return getPaperAccountBase()
  }
  balance = tradingConfig.initialBalance + closedPnl
  return getPaperAccountBase()
}

export function resetPaperAccountForDiagnostics() {
  balance = tradingConfig.initialBalance
  return getPaperAccountBase()
}
