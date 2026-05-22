import { tradingConfig } from '../config/tradingConfig.js'

let balance = tradingConfig.initialBalance

export function getPaperAccountBase() {
  return {
    balance,
    closedPnl: balance - tradingConfig.initialBalance,
  }
}

export function applyClosedPnl(pnl: number) {
  balance += pnl
}
