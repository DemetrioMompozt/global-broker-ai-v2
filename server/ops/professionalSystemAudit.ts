import { tradingConfig } from '../config/tradingConfig.js'
import type { ClosedTrade, CfdPosition } from '../storage/tradeStore.js'

type CheckStatus = 'PASS' | 'WATCH' | 'FAIL'
type AuditGrade = 'PROFESSIONAL_READY' | 'DEGRADED' | 'BLOCKED'

type AccountSnapshot = {
  balance: number
  closedPnl: number
  equity: number
  freeMargin: number
  marginLevel: number
  openPnl: number
  usedMargin: number
}

type ProfessionalSystemAuditInput = {
  account: AccountSnapshot
  agent: {
    lastEvaluationAt: string | null
    status: string
    workerRunning: boolean
  }
  closedTrades: ClosedTrade[]
  feeds: {
    binance?: { status?: string; lastUpdate?: string | null }
  }
  journal: {
    closedTradesLoaded: number
    corruptedTradesRejected: number
    disabled: boolean
    lastRepairAt: string | null
  }
  killSwitchStatus: string
  openPositions: CfdPosition[]
  safety: {
    brokerExecutionEnabled: boolean
    liveTradingEnabled?: boolean
    mt5RealExecution?: boolean
    paperOnly: boolean
    realTradingAllowed: boolean
    vtMarketsAllowOrderSend?: boolean
    vtMarketsRealTradingAllowed?: boolean
    vtMarketsReadOnly?: boolean
  }
  vtStatus: {
    status?: string
    readOnly?: boolean
    realTradingAllowed?: boolean
    orderSendAllowed?: boolean
  }
}

function check(id: string, label: string, status: CheckStatus, message: string) {
  return { id, label, message, status }
}

function money(value: number) {
  return `$${value.toFixed(2)}`
}

export function buildProfessionalSystemAudit(input: ProfessionalSystemAuditInput) {
  const checks: ReturnType<typeof check>[] = []
  const automaticActions: string[] = []
  const closedPnlFromJournal = input.closedTrades.reduce((sum, trade) => sum + trade.pnl, 0)
  const today = new Date().toISOString().slice(0, 10)
  const todayClosedTrades = input.closedTrades.filter((trade) => trade.closedAt.startsWith(today))
  const todayTargetHits = todayClosedTrades.filter((trade) => trade.exitReason === 'MICRO_CLOSE_TARGET')
  const todayPartialProfit = todayClosedTrades.filter((trade) => trade.pnl > 0 && trade.exitReason !== 'MICRO_CLOSE_TARGET')
  const todayPartialProfitPnl = todayPartialProfit.reduce((sum, trade) => sum + trade.pnl, 0)
  const expectedBalance = tradingConfig.initialBalance + closedPnlFromJournal
  const accountFinite = [
    input.account.balance,
    input.account.closedPnl,
    input.account.equity,
    input.account.openPnl,
    input.account.usedMargin,
    input.account.freeMargin,
    input.account.marginLevel,
  ].every(Number.isFinite)
  const ledgerMismatch = Math.abs(input.account.balance - expectedBalance) > 0.5
    || Math.abs(input.account.closedPnl - closedPnlFromJournal) > 0.5
  const impossibleTrade = input.closedTrades.find((trade) => !Number.isFinite(trade.pnl) || Math.abs(trade.pnl) > 100 || !Number.isFinite(trade.exitPrice) || trade.exitPrice <= 0)
  checks.push(check(
    'paper_ledger',
    'Paper ledger',
    accountFinite && !ledgerMismatch && !impossibleTrade ? 'PASS' : 'FAIL',
    accountFinite && !ledgerMismatch && !impossibleTrade
      ? `Balance paper coherente: ${money(input.account.balance)}.`
      : `Ledger incoherente. Balance esperado ${money(expectedBalance)}, balance actual ${money(input.account.balance)}.`,
  ))

  if (input.journal.corruptedTradesRejected > 0) {
    automaticActions.push(`${input.journal.corruptedTradesRejected} trade(s) corruptos fueron rechazados del journal.`)
  }
  checks.push(check(
    'journal_guard',
    'Journal guard',
    input.journal.disabled ? 'WATCH' : 'PASS',
    input.journal.lastRepairAt
      ? `Journal reparado automaticamente: ${input.journal.lastRepairAt}.`
      : `Journal activo con ${input.journal.closedTradesLoaded} cierre(s) validos.`,
  ))

  const safetyClear = input.safety.paperOnly
    && !input.safety.realTradingAllowed
    && !input.safety.brokerExecutionEnabled
    && !input.safety.liveTradingEnabled
    && !input.safety.mt5RealExecution
    && !input.safety.vtMarketsAllowOrderSend
    && !input.safety.vtMarketsRealTradingAllowed
    && input.safety.vtMarketsReadOnly !== false
    && input.killSwitchStatus === 'CLEAR'
  checks.push(check(
    'safety',
    'Safety lock',
    safetyClear ? 'PASS' : 'FAIL',
    safetyClear ? 'Paper/demo/read-only confirmado. Ordenes reales bloqueadas.' : 'Violacion de safety detectada.',
  ))

  const vtReady = input.vtStatus.status === 'CONNECTED_DEMO_READ_ONLY'
    && input.vtStatus.readOnly !== false
    && input.vtStatus.realTradingAllowed === false
    && input.vtStatus.orderSendAllowed === false
  checks.push(check(
    'vt_markets',
    'VT Markets demo',
    vtReady ? 'PASS' : 'WATCH',
    vtReady ? 'VT Markets conectado como feed CFD principal en solo lectura.' : `VT Markets no listo: ${input.vtStatus.status ?? 'UNKNOWN'}.`,
  ))

  const binanceReady = input.feeds.binance?.status === 'CONNECTED'
  checks.push(check(
    'binance',
    'Binance realtime',
    binanceReady ? 'PASS' : 'WATCH',
    binanceReady ? 'Binance conectado para cripto CFD complementario.' : `Binance no conectado: ${input.feeds.binance?.status ?? 'UNKNOWN'}.`,
  ))

  const lastEvalAgeSeconds = input.agent.lastEvaluationAt
    ? (Date.now() - new Date(input.agent.lastEvaluationAt).getTime()) / 1000
    : Number.POSITIVE_INFINITY
  const agentHealthy = input.agent.workerRunning && lastEvalAgeSeconds <= 20
  checks.push(check(
    'agent_loop',
    'Agent loop',
    agentHealthy ? 'PASS' : 'FAIL',
    agentHealthy ? `Ultima evaluacion hace ${lastEvalAgeSeconds.toFixed(0)}s.` : 'El agente no esta evaluando con frecuencia profesional.',
  ))

  const marginWatch = input.account.freeMargin < 0 || input.account.marginLevel < 115 || input.account.usedMargin > input.account.equity * 0.92
  checks.push(check(
    'margin',
    'Margin health',
    marginWatch ? 'WATCH' : 'PASS',
    marginWatch
      ? `Margen bajo: free ${money(input.account.freeMargin)}, level ${input.account.marginLevel.toFixed(0)}%.`
      : `Margen sano: free ${money(input.account.freeMargin)}, level ${input.account.marginLevel.toFixed(0)}%.`,
  ))

  const tooManyPositions = input.openPositions.length > tradingConfig.maxOpenPositions
  checks.push(check(
    'position_limits',
    'Position limits',
    tooManyPositions ? 'FAIL' : 'PASS',
    `${input.openPositions.length}/${tradingConfig.maxOpenPositions} posiciones paper abiertas.`,
  ))

  checks.push(check(
    'target_accounting',
    'Target accounting',
    todayClosedTrades.length > 0 && todayTargetHits.length === 0 ? 'WATCH' : 'PASS',
    todayClosedTrades.length === 0
      ? 'Sin cierres hoy: aun no hay resultado realizado que auditar contra target $2.'
      : todayTargetHits.length > 0
        ? `${todayTargetHits.length} cierre(s) alcanzaron target neto $2.`
        : `Closed P/L incluye ${money(todayPartialProfitPnl)} de cierres positivos parciales, pero 0 cierres llegaron al target $2.`,
  ))

  checks.push(check(
    'equity_vs_realized',
    'Equity vs realized',
    input.account.closedPnl > 0 && input.account.openPnl < -Math.max(0.5, input.account.closedPnl * 0.5) ? 'WATCH' : 'PASS',
    input.account.closedPnl > 0 && input.account.openPnl < 0
      ? `Balance realizado positivo ${money(input.account.closedPnl)}, pero P/L abierto ${money(input.account.openPnl)} reduce equity actual.`
      : `Equity coherente con P/L cerrado ${money(input.account.closedPnl)} y abierto ${money(input.account.openPnl)}.`,
  ))

  const failed = checks.filter((item) => item.status === 'FAIL')
  const watch = checks.filter((item) => item.status === 'WATCH')
  const grade: AuditGrade = failed.length ? 'BLOCKED' : watch.length ? 'DEGRADED' : 'PROFESSIONAL_READY'
  const score = Math.max(0, 100 - failed.length * 30 - watch.length * 10)
  const rootCause = failed[0]?.message ?? watch[0]?.message ?? null
  return {
    automaticActions,
    checks,
    grade,
    headline: grade === 'PROFESSIONAL_READY'
      ? 'Sistema paper profesional operativo.'
      : grade === 'DEGRADED'
        ? 'Sistema operativo con advertencias controladas.'
        : 'Sistema bloqueado por auditoria profesional.',
    nextAction: grade === 'BLOCKED'
      ? 'Bloquear nuevas entradas hasta corregir integridad, safety o worker.'
      : grade === 'DEGRADED'
        ? 'Operar solo con filtros estrictos y monitoreo de margen/feed.'
        : 'Continuar escaneando y gestionando oportunidades paper.',
    rootCause,
    score,
  }
}
