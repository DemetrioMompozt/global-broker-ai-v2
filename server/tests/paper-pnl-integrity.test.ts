import { applyClosedPnl, getPaperAccountBase, resetPaperAccountForDiagnostics } from '../storage/paperAccountStore.js'
import { addOpenPosition, closePosition, type CfdPosition } from '../storage/tradeStore.js'
import { assert, done } from './assert.js'

resetPaperAccountForDiagnostics()
const before = getPaperAccountBase()
const rejectedApply = applyClosedPnl(1_000_000)
assert(!rejectedApply.applied, 'Impossible closed P/L must not be applied to paper balance.')
assert(getPaperAccountBase().balance === before.balance, 'Rejected P/L must not change paper balance.')

const position: CfdPosition = {
  id: 'integrity-test',
  cfdSymbol: 'SOLUSD.cfd',
  underlyingSymbol: 'SOLUSDT',
  source: 'BINANCE_REALTIME',
  assetClass: 'CRYPTO_CFD',
  direction: 'LONG',
  strategy: 'IntegrityTest',
  entryPrice: 84.58,
  currentPrice: 84.6,
  previousPrice: 84.58,
  stopLoss: 80,
  takeProfit: 90,
  positionSize: 25,
  riskPercent: 0.4,
  riskUsd: 10,
  marginRequired: 100,
  leverage: 1,
  spreadAtEntry: 0.01,
  openPnl: 0,
  openPnlPercent: 0,
  provider: 'Binance',
  feedType: 'REALTIME_TICK',
  openedAt: new Date().toISOString(),
  lastPriceUpdate: new Date().toISOString(),
  thesis: 'test',
  cfdExpertScore: 90,
  cfdExpertReason: 'test',
  managementStatus: 'MANAGING_POSITION',
  nextAction: 'HOLD',
}

addOpenPosition(position)
const closed = closePosition(position.id, 827_530_056, 'MICRO_CLOSE_TARGET', 19_074_221_141, 19_074_221_141)
assert(Boolean(closed), 'Position should close into a guarded journal entry.')
assert(closed!.pnl === 0, 'Corrupted trade P/L must be neutralized.')
assert(closed!.exitReason.startsWith('PAPER_PNL_REJECTED_'), 'Corrupted trade must be marked as rejected.')

done('paper-pnl-integrity')
