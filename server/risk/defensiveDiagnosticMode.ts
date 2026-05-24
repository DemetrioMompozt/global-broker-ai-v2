import { numEnv } from '../config/env.js'
import { getClosedTrades, getOpenPositions } from '../storage/tradeStore.js'
import type { AccountSnapshot } from './accountHealthGuard.js'

export type DefensiveDiagnosticState = {
  active: boolean
  mode: 'DEFENSIVE_DIAGNOSTIC_MODE' | 'RECOVERY_PROBE_MODE'
  states: Array<'STOP_NEW_ENTRIES' | 'MANAGE_EXISTING_ONLY' | 'LOSS_ANALYSIS' | 'WAITING_FOR_REVIEW' | 'CONTROLLED_PROBE' | 'LIMITED_NEW_ENTRIES'>
  reason: string
  newEntriesBlocked: boolean
  newRiskUsd: number
  reactivationRiskUsd: number
  maxReactivationLeverage: number
  maxReactivationOpenPositions: number
  microProfitSuspended: boolean
}

let manualOverrideActive = false
let recoveryProbeActive = true
let manualReason = 'Activado manualmente por perdidas persistentes reportadas por el usuario.'
let manualActivatedAt = 0

function maxDiagnosticSeconds() {
  return Math.max(120, numEnv('DEFENSIVE_DIAGNOSTIC_MAX_SECONDS', 180))
}

function todayClosedTrades() {
  const today = new Date().toISOString().slice(0, 10)
  return getClosedTrades().filter((trade) => trade.closedAt.startsWith(today))
}

function consecutiveLosses() {
  let losses = 0
  for (const trade of todayClosedTrades()) {
    if (trade.pnl < 0) losses += 1
    else break
  }
  return losses
}

function profitFactorToday() {
  const trades = todayClosedTrades()
  const grossProfit = trades.filter((trade) => trade.pnl > 0).reduce((sum, trade) => sum + trade.pnl, 0)
  const grossLoss = Math.abs(trades.filter((trade) => trade.pnl < 0).reduce((sum, trade) => sum + trade.pnl, 0))
  if (grossLoss > 0) return grossProfit / grossLoss
  return grossProfit > 0 ? Infinity : 0
}

function expectedPayoffToday() {
  const trades = todayClosedTrades()
  if (!trades.length) return 0
  return trades.reduce((sum, trade) => sum + trade.pnl, 0) / trades.length
}

export function activateDefensiveDiagnosticMode(reason = 'Perdidas persistentes detectadas.') {
  manualOverrideActive = true
  recoveryProbeActive = false
  manualReason = reason
  manualActivatedAt = Date.now()
}

export function activateRecoveryProbeMode(reason = 'Punto medio activado: entradas paper limitadas para medir edge sin volver al modo agresivo.') {
  manualOverrideActive = false
  recoveryProbeActive = true
  manualReason = reason
}

export function getDefensiveDiagnosticMode(account: AccountSnapshot): DefensiveDiagnosticState {
  const closedToday = todayClosedTrades()
  const netPnlToday = closedToday.reduce((sum, trade) => sum + trade.pnl, 0)
  const openPnl = getOpenPositions().reduce((sum, position) => sum + position.openPnl, 0)
  const pf = profitFactorToday()
  const expectedPayoff = expectedPayoffToday()
  const reasons: string[] = []
  const softReasons: string[] = []
  const hardReasons: string[] = []

  const manualExpired = manualOverrideActive
    && manualActivatedAt > 0
    && Date.now() - manualActivatedAt > maxDiagnosticSeconds() * 1000
  if (manualExpired) {
    manualOverrideActive = false
    recoveryProbeActive = true
    manualReason = 'Diagnostico defensivo expiro automaticamente; pasar a recovery probe controlado para que el agente no quede congelado.'
  }
  if (manualOverrideActive) reasons.push(manualReason)
  if (netPnlToday < 0 && closedToday.length >= 5) softReasons.push(`P/L neto hoy negativo con ${closedToday.length} cierres.`)
  if (closedToday.length >= 10 && pf < 1) softReasons.push(`Profit Factor ${pf.toFixed(2)} menor a 1.0.`)
  if (closedToday.length >= 10 && expectedPayoff <= 0) softReasons.push(`Expected payoff ${expectedPayoff.toFixed(2)} no positivo.`)
  if (consecutiveLosses() >= 3) softReasons.push('Tres perdidas consecutivas detectadas.')
  if (openPnl < -20) hardReasons.push(`Open P/L ${openPnl.toFixed(2)} menor a -$20.`)
  if (account.marginLevel < 115) hardReasons.push(`Margin level ${account.marginLevel.toFixed(0)}% requiere diagnostico.`)
  if (account.freeMargin < 0) hardReasons.push(`Free margin ${account.freeMargin.toFixed(2)} negativo.`)
  reasons.push(...hardReasons)
  if (!recoveryProbeActive) reasons.push(...softReasons)

  const active = reasons.length > 0
  if (!active && recoveryProbeActive) {
    return {
      active: false,
      maxReactivationLeverage: 10,
      maxReactivationOpenPositions: 2,
      microProfitSuspended: false,
      mode: 'RECOVERY_PROBE_MODE',
      newEntriesBlocked: false,
      newRiskUsd: 10,
      reactivationRiskUsd: 10,
      reason: softReasons.length ? `${manualReason} Advertencias: ${softReasons.join(' ')}` : manualReason,
      states: ['CONTROLLED_PROBE', 'LIMITED_NEW_ENTRIES', 'LOSS_ANALYSIS'],
    }
  }

  return {
    active,
    maxReactivationLeverage: 10,
    maxReactivationOpenPositions: 1,
    microProfitSuspended: active,
    mode: 'DEFENSIVE_DIAGNOSTIC_MODE',
    newEntriesBlocked: active,
    newRiskUsd: active ? 0 : 10,
    reactivationRiskUsd: 10,
    reason: active ? reasons.join(' ') : 'Sin bloqueo defensivo activo.',
    states: active
      ? ['STOP_NEW_ENTRIES', 'MANAGE_EXISTING_ONLY', 'LOSS_ANALYSIS', 'WAITING_FOR_REVIEW']
      : [],
  }
}
