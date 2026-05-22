import { getMicroProfitTargetNetUsd } from '../config/microProfitConfig.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'
import { getClosedTrades, getOpenPositions } from '../storage/tradeStore.js'
import { buildLeverageDamage } from './leverageDamageAnalyzer.js'
import { buildLossAttribution } from './lossAttributionEngine.js'
import { buildTargetFeasibility } from './targetFeasibilityAnalyzer.js'

export type LearningRule = {
  id: string
  action: 'BAN_SYMBOL' | 'SUSPEND_SYMBOL' | 'BLOCK_STRATEGY' | 'RAISE_ENTRY_THRESHOLD' | 'CAP_LEVERAGE' | 'WAIT_FOR_EVIDENCE'
  applied: boolean
  evidence: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  solution: string
  target?: string
  unlockCondition: string
}

export type WinningPattern = {
  avgNetPnl: number
  avgTimeToCloseSeconds: number
  candlePattern: string | null
  direction: string
  evidence: string
  key: string
  sampleSize: number
  scoreBoost: number
  source: string
  strategy: string
  symbol: string
  targetHitRate: number
  whyItWorked: string
}

function todayClosedTrades() {
  const today = new Date().toISOString().slice(0, 10)
  return getClosedTrades().filter((trade) => trade.closedAt.startsWith(today))
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>()
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item])
  return groups
}

function groupLossesByReason() {
  const groups = new Map<string, { count: number; netPnl: number }>()
  for (const trade of todayClosedTrades()) {
    const current = groups.get(trade.exitReason) ?? { count: 0, netPnl: 0 }
    groups.set(trade.exitReason, { count: current.count + 1, netPnl: Number((current.netPnl + trade.pnl).toFixed(4)) })
  }
  return [...groups.entries()]
    .map(([reason, value]) => ({ reason, ...value }))
    .sort((a, b) => a.netPnl - b.netPnl)
}

function netToday() {
  return todayClosedTrades().reduce((sum, trade) => sum + trade.pnl, 0)
}

function exceptionalReversal(opportunity: Opportunity) {
  const moveMultiple = opportunity.edgeRequiredMoveBps && opportunity.edgeRequiredMoveBps > 0
    ? Math.abs(opportunity.edgeMoveBps ?? 0) / opportunity.edgeRequiredMoveBps
    : 0
  return (opportunity.opportunityScore ?? 0) >= 96
    && (opportunity.cfdExpertScore ?? 0) >= 94
    && moveMultiple >= 2.5
    && (opportunity.edgePersistence ?? 0) >= 0.78
    && (opportunity.edgeEfficiency ?? 0) >= 0.65
}

function buildWinningPatterns(): WinningPattern[] {
  const winners = todayClosedTrades().filter((trade) => trade.pnl > 0 || trade.exitReason === 'MICRO_CLOSE_TARGET')
  return [...groupBy(winners, (trade) => `${trade.cfdSymbol}|${trade.strategy}|${trade.direction}|${trade.source ?? 'UNKNOWN'}|${trade.candlePatternAtEntry ?? 'UNKNOWN_CANDLE'}`).entries()]
    .map(([key, trades]) => {
      const [symbol, strategy, direction, source, candlePattern] = key.split('|')
      const targetHits = trades.filter((trade) => trade.exitReason === 'MICRO_CLOSE_TARGET').length
      const avgNetPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0) / trades.length
      const avgTimeToCloseSeconds = trades.reduce((sum, trade) => sum + Math.max(0, new Date(trade.closedAt).getTime() - new Date(trade.openedAt).getTime()) / 1000, 0) / trades.length
      const scoreBoost = Math.min(10, 3 + targetHits * 2 + Math.max(0, avgNetPnl - getMicroProfitTargetNetUsd()) * 1.5)
      return {
        avgNetPnl: Number(avgNetPnl.toFixed(4)),
        avgTimeToCloseSeconds: Number(avgTimeToCloseSeconds.toFixed(1)),
        candlePattern: candlePattern === 'UNKNOWN_CANDLE' ? null : candlePattern,
        direction,
        evidence: `${trades.length} cierre(s), ${targetHits} target(s), avg net $${avgNetPnl.toFixed(2)}.`,
        key,
        sampleSize: trades.length,
        scoreBoost: Number(scoreBoost.toFixed(2)),
        source,
        strategy,
        symbol,
        targetHitRate: Number((targetHits / trades.length * 100).toFixed(1)),
        whyItWorked: `${symbol} ${direction} con ${strategy}${candlePattern !== 'UNKNOWN_CANDLE' ? ` y vela ${candlePattern}` : ''} funciono cuando llego a target o cerro positivo; repetir solo si costo, spread, confirmacion y comportamiento de velas son similares o mejores.`,
      }
    })
    .filter((pattern) => pattern.avgNetPnl > 0)
    .sort((a, b) => b.scoreBoost - a.scoreBoost)
}

function matchingWinningPattern(opportunity: Opportunity, patterns: WinningPattern[]) {
  return patterns.find((pattern) => pattern.symbol === opportunity.cfdSymbol
    && pattern.strategy === opportunity.strategy
    && pattern.direction === opportunity.direction
    && pattern.source === (opportunity.source ?? 'UNKNOWN'))
}

export function buildAdaptiveLearning() {
  const trades = todayClosedTrades()
  const attribution = buildLossAttribution()
  const target = buildTargetFeasibility()
  const leverage = buildLeverageDamage()
  const rules: LearningRule[] = []
  const winningPatterns = buildWinningPatterns()
  const netPnl = netToday()
  const closureReasons = groupLossesByReason()
  const worstClosureReason = closureReasons[0] ?? null

  for (const symbol of attribution.symbolDiagnostics) {
    if (symbol.status === 'BAN_FOR_SESSION') {
      rules.push({
        action: 'BAN_SYMBOL',
        applied: true,
        evidence: `${symbol.symbol}: ${symbol.trades} trades, net ${symbol.netPnl.toFixed(2)}, PF ${symbol.profitFactor ?? 0}.`,
        id: `ban_${symbol.symbol}`,
        severity: 'CRITICAL',
        solution: `No reentrar ${symbol.symbol} durante esta sesion.`,
        target: symbol.symbol,
        unlockCondition: 'Nueva sesion o reversal excepcional con score >=96, CFD score >=94, persistencia >=78% y eficiencia >=65%.',
      })
    } else if (symbol.status === 'SUSPEND') {
      rules.push({
        action: 'SUSPEND_SYMBOL',
        applied: true,
        evidence: `${symbol.symbol}: net ${symbol.netPnl.toFixed(2)}, win rate ${symbol.winRate.toFixed(1)}%.`,
        id: `suspend_${symbol.symbol}`,
        severity: 'HIGH',
        solution: `Solo permitir ${symbol.symbol} si aparece un reversal excepcional; no repetir patron perdedor.`,
        target: symbol.symbol,
        unlockCondition: 'Reversal excepcional o mejora de PF del simbolo por encima de 1.1.',
      })
    }
  }

  for (const strategy of attribution.worstStrategies) {
    if (strategy.netPnl < -4) {
      rules.push({
        action: 'BLOCK_STRATEGY',
        applied: true,
        evidence: `${strategy.name}: net ${strategy.netPnl.toFixed(2)} en ${strategy.trades} trades.`,
        id: `strategy_${strategy.name}`,
        severity: 'HIGH',
        solution: `No usar ${strategy.name} sin confirmacion mucho mas fuerte y menor costo.`,
        target: strategy.name,
        unlockCondition: 'La estrategia necesita 3 cierres paper consecutivos positivos en modo prueba antes de volver normal.',
      })
    }
  }

  if (attribution.mainLossDriver === 'bad_entries') {
    rules.push({
      action: 'RAISE_ENTRY_THRESHOLD',
      applied: true,
      evidence: 'La principal causa atribuida es mala entrada o tesis invalidada.',
      id: 'raise_bad_entries',
      severity: 'HIGH',
      solution: 'Exigir score >=94, CFD score >=92, movimiento >=2x requerido, persistencia >=72% y eficiencia >=58% en VT.',
      unlockCondition: 'Desactivar solo si 10 cierres nuevos tienen Expected Payoff positivo.',
    })
  }

  if (!target.viable && trades.length >= 5) {
    rules.push({
      action: 'WAIT_FOR_EVIDENCE',
      applied: true,
      evidence: `Target hit rate ${target.targetHitRate.toFixed(1)}%, costo/target ${(target.avgCostToProfitRatio * 100).toFixed(1)}%.`,
      id: 'target_2_evidence',
      severity: 'MEDIUM',
      solution: 'No forzar target $2 si el simbolo no muestra recorrido suficiente antes de invalidarse.',
      unlockCondition: 'Target hit rate >=45% y costo/target <=30% por simbolo.',
    })
  }

  if (leverage.averageLeverage > 10 && netPnl < 0) {
    rules.push({
      action: 'CAP_LEVERAGE',
      applied: true,
      evidence: `Leverage promedio ${leverage.averageLeverage.toFixed(1)}x con P/L neto ${netPnl.toFixed(2)}.`,
      id: 'cap_leverage_after_losses',
      severity: 'HIGH',
      solution: 'Mantener max leverage 10x hasta demostrar edge; no volver a 25x mientras PF < 1.',
      unlockCondition: 'PF >=1.3, Expected Payoff >0 y al menos 30 cierres.',
    })
  }

  const learningScore = Math.max(0, Math.min(100,
    50
    + (netPnl > 0 ? 15 : -20)
    + (target.viable ? 15 : -10)
    + Math.min(12, winningPatterns.length * 4)
    - attribution.worstSymbols.length * 4
    - rules.filter((rule) => rule.severity === 'CRITICAL').length * 10
  ))

  const status = trades.length < 5
    ? 'OBSERVING'
    : rules.some((rule) => rule.severity === 'CRITICAL')
      ? 'PROTECTING'
      : netPnl < 0
        ? 'ADAPTING'
        : 'READY_TO_TEST'

  const solutions = [
    'No repetir simbolos suspendidos por sesion.',
    'Repetir solo patrones ganadores con condiciones iguales o mejores: simbolo, estrategia, direccion, spread y confirmacion.',
    'Usar risk $10 solo cuando el gate apruebe edge excepcional o simbolo limpio.',
    'Separar aprendizaje por simbolo/estrategia/direccion antes de escalar.',
  ]
  if (worstClosureReason) solutions.push(`Atacar causa de cierre dominante: ${worstClosureReason.reason}.`)
  if (attribution.mainLossDriver === 'bad_entries') solutions.push('Solucion inmediata: endurecer entrada y dejar de perseguir ticks cortos.')

  return {
    lastUpdated: new Date().toISOString(),
    learningScore: Number(learningScore.toFixed(0)),
    status,
    sampleSize: trades.length,
    netPnlToday: Number(netPnl.toFixed(4)),
    openPositions: getOpenPositions().length,
    mainLesson: rules[0]?.solution ?? 'Aun recolectando muestra: no hay patron concluyente.',
    mainProblem: attribution.mainLossDriver,
    worstClosureReason,
    winningPatterns,
    preferredSetups: winningPatterns.slice(0, 5).map((pattern) => ({
      symbol: pattern.symbol,
      strategy: pattern.strategy,
      direction: pattern.direction,
      source: pattern.source,
      reason: pattern.whyItWorked,
      scoreBoost: pattern.scoreBoost,
      candlePattern: pattern.candlePattern,
    })),
    rules,
    solutions,
    nextExperiment: rules.length
      ? 'Probar solo oportunidades limpias no suspendidas; max 2 posiciones, risk $10, leverage <=10x.'
      : 'Recolectar muestra con entradas confirmadas y registrar resultado por simbolo.',
  }
}

export function validateAdaptiveLearningGate(opportunity: Opportunity) {
  const learning = buildAdaptiveLearning()
  const reasons: string[] = []
  const exceptional = exceptionalReversal(opportunity)
  const winningPattern = matchingWinningPattern(opportunity, learning.winningPatterns)

  for (const rule of learning.rules) {
    if ((rule.action === 'BAN_SYMBOL' || rule.action === 'SUSPEND_SYMBOL') && rule.target === opportunity.cfdSymbol && !exceptional && !winningPattern) {
      reasons.push(`learning ${rule.action}: ${rule.evidence} ${rule.solution}`)
    }
    if (rule.action === 'BLOCK_STRATEGY' && rule.target === opportunity.strategy && !exceptional && !winningPattern) {
      reasons.push(`learning BLOCK_STRATEGY: ${rule.evidence} ${rule.solution}`)
    }
    if (rule.action === 'RAISE_ENTRY_THRESHOLD' && opportunity.source === 'VT_MARKETS_MT5_DEMO' && !exceptional && !winningPattern) {
      reasons.push(`learning RAISE_ENTRY_THRESHOLD: ${rule.solution}`)
    }
  }

  return {
    approved: reasons.length === 0,
    learning,
    reason: reasons.length
      ? `Adaptive learning bloquea ${opportunity.cfdSymbol}: ${reasons.join(' ')}`
      : winningPattern
        ? `Adaptive learning favorece ${opportunity.cfdSymbol}: coincide con patron ganador (${winningPattern.evidence})`
        : `Adaptive learning aprueba ${opportunity.cfdSymbol}: no viola reglas aprendidas de la sesion.`,
  }
}

export function scoreOpportunityWithLearning(opportunity: Opportunity) {
  const learning = buildAdaptiveLearning()
  const pattern = matchingWinningPattern(opportunity, learning.winningPatterns)
  const penalty = learning.rules.some((rule) => (rule.action === 'BAN_SYMBOL' || rule.action === 'SUSPEND_SYMBOL') && rule.target === opportunity.cfdSymbol)
    ? -20
    : learning.rules.some((rule) => rule.action === 'BLOCK_STRATEGY' && rule.target === opportunity.strategy)
      ? -10
      : 0
  const boost = pattern?.scoreBoost ?? 0
  return {
    adjustedScore: Number(((opportunity.opportunityScore ?? 0) + boost + penalty).toFixed(4)),
    boost,
    penalty,
    reason: pattern ? pattern.whyItWorked : penalty < 0 ? 'Penalizado por regla aprendida de perdidas recientes.' : 'Sin patron aprendido aplicable.',
  }
}
