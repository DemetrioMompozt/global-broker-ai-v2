import { buildTraderVideoMethodLearning } from '../strategy/traderVideoMethodLearning.js'
import { buildTraderVideoReplicationMode } from '../strategy/traderVideoReplicationMode.js'
import { assert, done } from './assert.js'

const baseTrade = {
  closedAt: '2026-06-05T14:05:00.000Z',
  durationSeconds: 600,
  entryPrice: 5000,
  exitPrice: 5002,
  moveRatioAtEntry: 1.2,
  openedAt: '2026-06-05T13:55:00.000Z',
  scoreAtEntry: 90,
  side: 'SELL' as const,
  source: 'V4_DEMO' as const,
  status: 'CLOSED' as const,
  stopUsd: 0.02,
  strategy: null,
  symbol: 'ES',
  targetUsd: 0.04,
  technicalClosure: false,
}

let learning = buildTraderVideoMethodLearning({
  tradeHistory: {
    items: [
      { ...baseTrade, closeReason: 'TARGET', id: '1', pnlUsd: 0.05 },
      { ...baseTrade, closeReason: 'STOP', id: '2', pnlUsd: -0.02 },
      { ...baseTrade, closeReason: 'TIMEOUT', id: '3', pnlUsd: 0.01 },
    ],
  },
  traderVideoReplicationMode: buildTraderVideoReplicationMode(),
})
assert(learning.state === 'INSUFFICIENT_SAMPLE', 'Con 3 trades debe bloquear aprendizaje fuerte.')
assert(!learning.canApplyStrongLearning, 'No debe aplicar aprendizaje fuerte con muestra pequena.')

learning = buildTraderVideoMethodLearning({
  tradeHistory: {
    items: Array.from({ length: 30 }, (_, index) => ({
      ...baseTrade,
      closeReason: index % 3 === 0 ? 'STOP' : 'TARGET',
      id: String(index),
      pnlUsd: index % 3 === 0 ? -0.01 : 0.03,
    })),
  },
  traderVideoReplicationMode: buildTraderVideoReplicationMode(),
})
assert(learning.evidenceQuality === 'VERIFIED', '30 trades deben producir evidencia verificada.')
assert(learning.canApplyStrongLearning, 'PF positivo con muestra verificada puede aplicar aprendizaje fuerte.')

done('trader-video-method-learning')
