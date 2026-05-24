import { buildProfessionalSystemAudit } from '../ops/professionalSystemAudit.js'
import { assert, done } from './assert.js'

const baseInput = {
  account: {
    balance: 2500,
    closedPnl: 0,
    equity: 2500,
    freeMargin: 2500,
    marginLevel: 9999,
    openPnl: 0,
    usedMargin: 0,
  },
  agent: {
    lastEvaluationAt: new Date().toISOString(),
    status: 'RUNNING',
    workerRunning: true,
  },
  closedTrades: [],
  feeds: {
    binance: { status: 'CONNECTED', lastUpdate: new Date().toISOString() },
  },
  journal: {
    closedTradesLoaded: 0,
    corruptedTradesRejected: 0,
    disabled: false,
    lastRepairAt: null,
  },
  killSwitchStatus: 'CLEAR',
  openPositions: [],
  safety: {
    brokerExecutionEnabled: false,
    liveTradingEnabled: false,
    mt5RealExecution: false,
    paperOnly: true,
    realTradingAllowed: false,
    vtMarketsAllowOrderSend: false,
    vtMarketsRealTradingAllowed: false,
    vtMarketsReadOnly: true,
  },
  vtStatus: {
    orderSendAllowed: false,
    readOnly: true,
    realTradingAllowed: false,
    status: 'CONNECTED_DEMO_READ_ONLY',
  },
}

const ready = buildProfessionalSystemAudit(baseInput)
assert(ready.grade === 'PROFESSIONAL_READY', 'Safe paper system should be professional ready.')

const corrupted = buildProfessionalSystemAudit({
  ...baseInput,
  account: { ...baseInput.account, balance: 19_000_000_000, closedPnl: 19_000_000_000 },
})
assert(corrupted.grade === 'BLOCKED', 'Corrupted paper balance must block operation.')
assert(corrupted.checks.some((item) => item.id === 'paper_ledger' && item.status === 'FAIL'), 'Ledger check must fail.')

const unsafe = buildProfessionalSystemAudit({
  ...baseInput,
  safety: { ...baseInput.safety, realTradingAllowed: true },
})
assert(unsafe.grade === 'BLOCKED', 'Real trading flag must block operation.')

const staleAgent = buildProfessionalSystemAudit({
  ...baseInput,
  agent: { ...baseInput.agent, lastEvaluationAt: new Date(Date.now() - 60_000).toISOString() },
})
assert(staleAgent.grade === 'BLOCKED', 'Stale agent loop must block operation.')

done('professional-system-audit')
