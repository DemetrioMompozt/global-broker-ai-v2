import type { PaperTradeHistoryItem } from './paperTradeHistory.js'
import type { TraderVideoReplicationStatus } from './traderVideoReplicationMode.js'

export type TraderVideoMethodLearningStatus = {
  activeHypotheses: string[]
  canApplyStrongLearning: boolean
  currentLesson: string
  evidenceQuality: 'INSUFFICIENT' | 'WEAK' | 'DEVELOPING' | 'VERIFIED'
  learningMode: 'OBSERVE_ONLY'
  methodTrades: number
  nextDataNeeded: string
  profitFactor: number
  recommendations: Array<{
    action: 'KEEP_RULE' | 'OBSERVE_MORE' | 'TIGHTEN_RULE' | 'TEST_ADJUSTMENT'
    reason: string
    rule: string
  }>
  state: 'INSUFFICIENT_SAMPLE' | 'LEARNING' | 'PROMISING' | 'NEEDS_MORE_EVIDENCE'
  timestamp: string
  winRate: number
}

const sp500Symbols = new Set(['US500', 'SP500', 'SPX500', 'SPX', 'ES', 'MES', 'ESM2026', 'MESM2026', 'ESU2026', 'MESU2026', 'ESZ2026', 'MESZ2026'])

function isSp500MethodTrade(trade: PaperTradeHistoryItem) {
  return sp500Symbols.has(trade.symbol) && !trade.technicalClosure
}

function pf(grossProfit: number, grossLoss: number) {
  if (grossProfit <= 0 && grossLoss <= 0) return 0
  if (grossLoss <= 0) return grossProfit > 0 ? 99 : 0
  return grossProfit / grossLoss
}

export function buildTraderVideoMethodLearning(input: {
  now?: Date
  tradeHistory: { items: PaperTradeHistoryItem[] }
  traderVideoReplicationMode: TraderVideoReplicationStatus
}): TraderVideoMethodLearningStatus {
  const trades = input.tradeHistory.items
    .filter(isSp500MethodTrade)
    .filter((trade) => trade.status === 'CLOSED' && typeof trade.pnlUsd === 'number')
  const wins = trades.filter((trade) => Number(trade.pnlUsd) > 0)
  const losses = trades.filter((trade) => Number(trade.pnlUsd) < 0)
  const timeouts = trades.filter((trade) => String(trade.closeReason ?? '').includes('TIME'))
  const grossProfit = wins.reduce((sum, trade) => sum + Number(trade.pnlUsd ?? 0), 0)
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + Number(trade.pnlUsd ?? 0), 0))
  const profitFactor = pf(grossProfit, grossLoss)
  const winRate = trades.length ? wins.length / trades.length : 0
  const recommendations: TraderVideoMethodLearningStatus['recommendations'] = [
    {
      action: 'KEEP_RULE',
      reason: 'La metodologia exige mapa M30/M1, trampa, fallo de recuperacion y caja rojo/verde antes de abrir.',
      rule: 'No operar sin secuencia completa del video.',
    },
  ]

  if (trades.length < 10) {
    recommendations.push({
      action: 'OBSERVE_MORE',
      reason: `Solo hay ${trades.length} trades cerrados del metodo S&P; no hay muestra para mejorar reglas sin sobreajustar.`,
      rule: 'Acumular evidencia antes de ajustar.',
    })
  }
  if (timeouts.length >= Math.max(3, trades.length * 0.35)) {
    recommendations.push({
      action: 'TEST_ADJUSTMENT',
      reason: 'Hay muchos cierres por tiempo; revisar si las rotaciones esperadas estan tardando mas o si el target queda lejos.',
      rule: 'Auditar timeout vs rotacion real.',
    })
  }
  if (input.traderVideoReplicationMode.trendlineFailure?.state === 'RECOVERY_ATTEMPT_FAILED') {
    recommendations.push({
      action: 'KEEP_RULE',
      reason: 'El setup actual contiene fallo de recuperacion de linea de tendencia; es evidencia central del video.',
      rule: 'Priorizar fallos de recuperacion sobre entradas por persecucion.',
    })
  }
  if (input.traderVideoReplicationMode.state === 'BLOCKED_BAD_RR') {
    recommendations.push({
      action: 'TIGHTEN_RULE',
      reason: 'El metodo detecto estructura, pero la caja verde no justifica la caja roja.',
      rule: 'Bloquear cuando rojo/verde no paga al menos la relacion minima.',
    })
  }

  const evidenceQuality: TraderVideoMethodLearningStatus['evidenceQuality'] = trades.length >= 30
    ? 'VERIFIED'
    : trades.length >= 15
      ? 'DEVELOPING'
      : trades.length >= 5
        ? 'WEAK'
        : 'INSUFFICIENT'
  const state: TraderVideoMethodLearningStatus['state'] = evidenceQuality === 'INSUFFICIENT'
    ? 'INSUFFICIENT_SAMPLE'
    : profitFactor >= 1.25 && winRate >= 0.45
      ? 'PROMISING'
      : evidenceQuality === 'WEAK'
        ? 'NEEDS_MORE_EVIDENCE'
        : 'LEARNING'

  return {
    activeHypotheses: [
      'Las marcas M30 de movimientos trascendentales definen zonas donde otros traders reaccionan.',
      'El rango 09:30-09:45 New York contiene gran parte de la rotacion posterior.',
      'La entrada mejora cuando hay linea de tendencia, ruptura y fallo de recuperacion.',
      'La caja rojo/verde filtra setups con mal pago estructural.',
    ],
    canApplyStrongLearning: evidenceQuality === 'VERIFIED' && profitFactor >= 1.3,
    currentLesson: trades.length
      ? `Muestra S&P ${trades.length}: PF ${profitFactor.toFixed(2)}, win rate ${(winRate * 100).toFixed(1)}%. Aprendizaje fuerte ${evidenceQuality === 'VERIFIED' ? 'posible' : 'bloqueado por muestra'}.`
      : 'Sin trades cerrados suficientes del metodo S&P; por ahora solo observa y registra evidencia.',
    evidenceQuality,
    learningMode: 'OBSERVE_ONLY',
    methodTrades: trades.length,
    nextDataNeeded: trades.length < 30
      ? `Faltan ${30 - trades.length} trades cerrados del metodo S&P para aprendizaje verificado.`
      : 'Comparar reglas por tipo de marca M30, trampa y fallo de trendline.',
    profitFactor: Number(profitFactor.toFixed(2)),
    recommendations,
    state,
    timestamp: (input.now ?? new Date()).toISOString(),
    winRate: Number((winRate * 100).toFixed(1)),
  }
}
