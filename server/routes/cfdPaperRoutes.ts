import { Router } from 'express'
import { tradingConfig } from '../config/tradingConfig.js'
import { getMicroProfitStatus, setMicroProfitTargetNetUsd } from '../config/microProfitConfig.js'
import { getSafetyConfig } from '../config/safetyConfig.js'
import { getCfdQuote } from '../cfd/cfdPricingEngine.js'
import { evaluateCapitalRecycling } from '../cfd/capitalRecyclingEngine.js'
import { buildCfdTraderSkillReadout, type TraderSkillAction } from '../cfd/cfdTraderSkillEngine.js'
import { validateTraderEntryGate } from '../cfd/cfdTraderEntryGate.js'
import { openCfdPaperPosition } from '../cfd/cfdPaperExecutionEngine.js'
import { updateOpenPositions } from '../cfd/cfdPositionManager.js'
import { minimumRotationHoldSeconds, reviewOpenPositions, type RotationDecision } from '../cfd/positionRotationEngine.js'
import { getLastCfdExpertEvaluation } from '../cfd/cfdExpertAgent.js'
import { getFeedStatuses } from '../feeds/livePriceService.js'
import { buildAdaptiveLearning } from '../performance/adaptiveLearningEngine.js'
import { getCfdResearchLearningStatus, maybeRunCfdResearchLearning, runCfdResearchLearningNow } from '../performance/cfdResearchLearningAgent.js'
import { getWeekendLearningCampaignStatus, updateWeekendLearningCampaign } from '../learning/weekendLearningCampaign.js'
import { buildAgentEffectiveness } from '../performance/agentEffectivenessEngine.js'
import { buildLeverageDamage } from '../performance/leverageDamageAnalyzer.js'
import { buildLossAttribution } from '../performance/lossAttributionEngine.js'
import { getPerformanceSummary } from '../performance/performanceEngine.js'
import { buildTargetFeasibility } from '../performance/targetFeasibilityAnalyzer.js'
import { getKillSwitchStatus } from '../risk/killSwitch.js'
import { getPerformanceGuardStatus } from '../risk/performanceGuard.js'
import { isRecoveryMode, validateRecoveryCandidate } from '../risk/effectivenessRecoveryGuard.js'
import { activateDefensiveDiagnosticMode, activateRecoveryProbeMode, getDefensiveDiagnosticMode } from '../risk/defensiveDiagnosticMode.js'
import { evaluateAccountHealth, type AccountHealthState } from '../risk/accountHealthGuard.js'
import { multiPositionLimits } from '../risk/multiPositionPortfolioPolicy.js'
import { scanGlobalOpportunities, type Opportunity } from '../strategy/globalOpportunityScanner.js'
import { buildControlledProbeOpportunity } from '../strategy/controlledProbePolicy.js'
import { getPaperAccountBase } from '../storage/paperAccountStore.js'
import { applyClosedPnl } from '../storage/paperAccountStore.js'
import { closePosition, getClosedTrades, getOpenPositions } from '../storage/tradeStore.js'
import { getAccount as getVtAccount, getSymbols as getVtSymbols, getVtMarketsStatus } from '../broker/vtMarketsConnector.js'

export const cfdPaperRouter = Router()

type AgentStatus = 'RUNNING' | 'STOPPED' | 'WATCHING' | 'MANAGING'
type Activity = { time: string; action: string; symbol?: string; reason: string; pnl?: number }

let agentStatus: AgentStatus = 'STOPPED'
let lastEvaluationAt: string | null = null
let nextEvaluationAt: string | null = null
let lastDecision: Record<string, unknown> = { decision: 'WAITING_START', reason: 'Agente listo en paper only.' }
let lastOpportunities: Opportunity[] = []
let lastBlocked: Array<{ cfdSymbol: string; reason: string }> = []
let lastTraderDecision: ReturnType<typeof buildTraderDecision> | null = null
let lastEffectivenessStatus: string | null = null
let lastTraderSkillActionsTaken: TraderSkillAction[] = []
let lastTraderSkillBlockedActions: TraderSkillAction[] = []
let lastLearningSignature: string | null = null
let lastResearchLearningRunAt: string | null = null
const activityFeed: Activity[] = []
let loop: NodeJS.Timeout | undefined
let lastStatusPositionUpdateAt = 0
let statusPositionUpdatePromise: Promise<unknown> | null = null
let diagnosticModeAnnounced = false

function pushActivity(item: Omit<Activity, 'time'>) {
  activityFeed.unshift({ time: new Date().toISOString(), ...item })
  if (activityFeed.length > 80) activityFeed.splice(80)
}

function accountSnapshot() {
  const base = getPaperAccountBase()
  const open = getOpenPositions()
  const openPnl = open.reduce((sum, position) => sum + position.openPnl, 0)
  const usedMargin = open.reduce((sum, position) => sum + position.marginRequired, 0)
  const equity = base.balance + openPnl
  return {
    balance: base.balance,
    equity,
    openPnl,
    closedPnl: base.closedPnl,
    usedMargin,
    freeMargin: equity - usedMargin,
    marginLevel: usedMargin > 0 ? equity / usedMargin * 100 : 9999,
    portfolioLeverage: equity > 0 ? open.reduce((sum, position) => sum + position.currentPrice * position.positionSize, 0) / equity : 0,
  }
}

async function updatePositionsForStatus() {
  const now = Date.now()
  if (now - lastStatusPositionUpdateAt < 2_000) return
  if (!statusPositionUpdatePromise) {
    statusPositionUpdatePromise = updateOpenPositions()
      .catch((error) => {
        pushActivity({ action: 'FEED_WARNING', reason: `Status mantuvo ultimo precio por error temporal: ${error instanceof Error ? error.message : String(error)}` })
      })
      .finally(() => {
        lastStatusPositionUpdateAt = Date.now()
        statusPositionUpdatePromise = null
      })
  }
  await statusPositionUpdatePromise
}

function microProfitSnapshot() {
  const status = getMicroProfitStatus()
  const today = new Date().toISOString().slice(0, 10)
  const todayTrades = getClosedTrades().filter((trade) => trade.closedAt.startsWith(today))
  const wins = todayTrades.filter((trade) => trade.pnl > 0)
  const losses = todayTrades.filter((trade) => trade.pnl < 0)
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0))
  const totalCost = getOpenPositions().reduce((sum, trade) => sum + (trade.totalEstimatedCost ?? 0), 0)
    + todayTrades.reduce((sum, trade) => sum + (trade.totalEstimatedCost ?? 0), 0)
  const totalProfitBase = getOpenPositions().reduce((sum, trade) => sum + Math.abs(trade.grossPnl ?? trade.openPnl ?? 0), 0)
    + todayTrades.reduce((sum, trade) => sum + Math.abs(trade.grossPnl ?? trade.pnl ?? 0), 0)
  return {
    ...status,
    tradesToday: todayTrades.length,
    netProfitToday: todayTrades.reduce((sum, trade) => sum + trade.pnl, 0),
    averageNetWin: wins.length ? grossProfit / wins.length : 0,
    averageNetLoss: losses.length ? grossLoss / losses.length : 0,
    costToProfitRatio: totalProfitBase > 0 ? totalCost / totalProfitBase : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0,
    expectedPayoff: todayTrades.length ? todayTrades.reduce((sum, trade) => sum + trade.pnl, 0) / todayTrades.length : 0,
  }
}

function buildTraderDecision(input: {
  accountHealth: AccountHealthState
  bestOpportunity: Opportunity | null
  blockNewEntries: boolean
  maxAllowedOpenPositions: number
  reason: string
  weakestPosition: RotationDecision | null
}) {
  return {
    accountHealth: input.accountHealth,
    action: input.accountHealth === 'CRITICAL_MARGIN_DEFENSIVE'
      ? 'Close weak position' as const
      : input.blockNewEntries
        ? 'Wait for margin recovery' as const
        : input.bestOpportunity
          ? 'Open new opportunity' as const
          : 'Hold all' as const,
    bestOpportunity: input.bestOpportunity?.cfdSymbol ?? null,
    blockNewEntries: input.blockNewEntries,
    maxAllowedOpenPositions: input.maxAllowedOpenPositions,
    reason: input.reason,
    weakestPosition: input.weakestPosition ? {
      action: input.weakestPosition.action,
      capitalEfficiencyScore: input.weakestPosition.capitalEfficiencyScore,
      cfdSymbol: input.weakestPosition.position.cfdSymbol,
      marginEfficiencyScore: input.weakestPosition.marginEfficiencyScore,
      openPnl: input.weakestPosition.position.openPnl,
      positionQualityScore: input.weakestPosition.positionQualityScore,
      reason: input.weakestPosition.reason,
    } : null,
  }
}

function closeWeakPosition(decision: RotationDecision, reason = 'POSITION_CLOSE_WEAK') {
  const position = decision.position
  const closed = closePosition(position.id, position.currentPrice, reason, position.openPnl, position.grossPnl)
  if (closed) {
    applyClosedPnl(closed.pnl)
    pushActivity({
      action: reason === 'CAPITAL_RECYCLE' ? 'CLOSE_BY_ROTATION' : reason === 'POSITION_CLOSE_WEAK' ? 'CLOSE_BY_STALE' : reason,
      symbol: position.cfdSymbol,
      reason: `${decision.reason} Score ${decision.positionQualityScore.toFixed(0)}.`,
      pnl: closed.pnl,
    })
  }
  return closed
}

function emitEffectivenessEvents(effectiveness: ReturnType<typeof buildAgentEffectiveness>, account: ReturnType<typeof accountSnapshot>) {
  if (account.marginLevel >= 250 && account.freeMargin > account.equity * 0.25) {
    pushActivity({ action: 'MARGIN_HEALTHY', reason: `Margin level ${account.marginLevel.toFixed(0)}%, free margin ${account.freeMargin.toFixed(2)}.` })
  } else {
    pushActivity({ action: 'MARGIN_WATCH', reason: `Margin level ${account.marginLevel.toFixed(0)}%, free margin ${account.freeMargin.toFixed(2)}.` })
  }
  if (effectiveness.status !== lastEffectivenessStatus) {
    if (effectiveness.status === 'EFFECTIVE') pushActivity({ action: 'EFFECTIVENESS_EFFECTIVE', reason: effectiveness.reason })
    if (effectiveness.status === 'CORRECTIVE') pushActivity({ action: 'EFFECTIVENESS_CORRECTIVE', reason: effectiveness.reason })
    if (effectiveness.status === 'WEAK' || effectiveness.status === 'INEFFICIENT') pushActivity({ action: 'EFFECTIVENESS_WEAK', reason: effectiveness.reason })
    lastEffectivenessStatus = effectiveness.status
  }
}

function executeTraderSkillActions(input: {
  readout: ReturnType<typeof buildCfdTraderSkillReadout>
  rotation: ReturnType<typeof reviewOpenPositions>
}) {
  const actionsTaken: TraderSkillAction[] = []
  const blockedActions: TraderSkillAction[] = []
  const open = getOpenPositions()

  pushActivity({ action: 'TRADER_SKILL_READING', symbol: input.readout.mode, reason: input.readout.reading })

  for (const action of input.readout.executableActions) {
    if (action.type === 'WATCH_RISK_POSITION' && action.symbol) {
      actionsTaken.push(action)
      pushActivity({ action: 'WATCHED_RISK_POSITION', symbol: action.symbol, reason: action.reason })
      continue
    }

    if (action.type === 'HOLD_WINNERS') {
      const winner = open.find((position) => position.openPnl > 0)
      if (winner) {
        actionsTaken.push({ ...action, symbol: winner.cfdSymbol })
        pushActivity({ action: 'HOLD_BY_TRADER_SKILL', symbol: winner.cfdSymbol, reason: action.reason })
      } else {
        blockedActions.push({ ...action, reason: 'Sin posicion ganadora que mantener.' })
      }
      continue
    }

    if (action.type === 'BLOCK_NEW_ENTRIES') {
      actionsTaken.push(action)
      pushActivity({ action: 'BLOCK_BY_TRADER_DEFENSIVE_MODE', reason: action.reason })
      continue
    }

    if (action.type === 'CLOSE_STALE_NEGATIVE_POSITION' && action.symbol) {
      const position = open.find((item) => item.cfdSymbol === action.symbol)
      const timeOpenSeconds = position ? Math.max(0, (Date.now() - new Date(position.openedAt).getTime()) / 1000) : 0
      const feedOk = position ? position.feedType !== 'ERROR' && Number.isFinite(position.currentPrice) && position.currentPrice > 0 : false
      if (position && position.openPnl <= -1 && timeOpenSeconds > minimumRotationHoldSeconds() && feedOk) {
        const closed = closePosition(position.id, position.currentPrice, 'POSITION_CLOSE_WEAK', position.openPnl, position.grossPnl)
        if (closed) {
          applyClosedPnl(closed.pnl)
          actionsTaken.push(action)
          pushActivity({ action: 'CLOSE_BY_TRADER_SKILL', symbol: position.cfdSymbol, reason: action.reason, pnl: closed.pnl })
          pushActivity({ action: 'TRADER_SKILL_ACTION', symbol: position.cfdSymbol, reason: action.reason, pnl: closed.pnl })
        }
      } else {
        const blocked = {
          ...action,
          reason: `Cierre bloqueado: requiere perdida <= -$1, mas de ${Math.round(minimumRotationHoldSeconds() / 60)}m y precio valido. ${action.reason}`,
        }
        blockedActions.push(blocked)
        pushActivity({ action: 'TRADER_SKILL_BLOCKED_ACTION', symbol: action.symbol, reason: blocked.reason })
      }
      continue
    }

    if (action.type === 'ROTATE_CAPITAL') {
      actionsTaken.push(action)
      pushActivity({ action: 'ROTATE_BY_TRADER_SKILL', symbol: action.symbol, reason: action.reason })
      continue
    }

    if (action.type === 'MANAGE_REVIEW') {
      actionsTaken.push(action)
      pushActivity({ action: 'HOLD_BY_TRADER_SKILL', reason: action.reason })
      continue
    }
  }

  lastTraderSkillActionsTaken = actionsTaken
  lastTraderSkillBlockedActions = blockedActions
  return { actionsTaken, blockedActions }
}

async function evaluateAgentCycle() {
  lastEvaluationAt = new Date().toISOString()
  nextEvaluationAt = new Date(Date.now() + tradingConfig.agentIntervalMs).toISOString()
  const managed = await updateOpenPositions()
  for (const position of managed.updated) {
    pushActivity({ action: 'MANAGE', symbol: position.cfdSymbol, reason: `P/L ${position.openPnl.toFixed(4)} - ${position.nextAction}` })
  }
  for (const trade of managed.closed) {
    const action = trade.exitReason === 'MICRO_CLOSE_TARGET'
      ? 'TARGET_HIT_2_USD'
      : trade.exitReason === 'STOP_LOSS'
        ? 'CLOSE_BY_STOP'
        : trade.exitReason === 'MICRO_MAX_LOSS'
        ? 'CLOSE_BY_STOP'
        : trade.exitReason === 'TRADER_SKILL_CUT_LOSER' || trade.exitReason === 'TRADER_SKILL_GIVEBACK_PROTECTION'
          ? 'CLOSE_BY_TRADER_SKILL'
        : trade.exitReason === 'THESIS_INVALIDATED' || trade.exitReason === 'THESIS_LOST_NO_EDGE' || trade.exitReason === 'CRYPTO_FAST_INVALIDATION'
            ? 'CLOSE_BY_THESIS_INVALIDATION'
        : trade.exitReason === 'CAPITAL_RECYCLE'
          ? 'CLOSE_BY_ROTATION'
          : trade.exitReason === 'POSITION_CLOSE_WEAK'
            ? 'CLOSE_BY_STALE'
            : 'CLOSE'
    pushActivity({
      action,
      symbol: trade.cfdSymbol,
      reason: trade.exitReason === 'MICRO_CLOSE_TARGET' ? `Cierre por target neto $${trade.microTargetNetUsd ?? getMicroProfitStatus().targetNetUsd} alcanzado.` : trade.exitReason,
      pnl: trade.pnl,
    })
  }
  let account = accountSnapshot()
  let health = evaluateAccountHealth(account, getOpenPositions())
  const defensiveDiagnostic = getDefensiveDiagnosticMode(account)
  if (defensiveDiagnostic.active && !diagnosticModeAnnounced) {
    diagnosticModeAnnounced = true
    pushActivity({ action: 'DEFENSIVE_DIAGNOSTIC_ON', reason: defensiveDiagnostic.reason })
    pushActivity({ action: 'STOP_NEW_ENTRIES', reason: 'El agente entra en modo diagnostico por perdidas persistentes.' })
    pushActivity({ action: 'LEVERAGE_REDUCED', reason: 'Nuevas entradas suspendidas; reactivacion propuesta con risk $10 y leverage maximo 10x, sin volver al 25x.' })
    pushActivity({ action: 'TARGET_NOT_VIABLE', reason: 'Target $2 suspendido hasta validar edge y costos por simbolo.' })
  }
  if (health.accountHealth === 'CRITICAL_MARGIN_DEFENSIVE') {
    pushActivity({ action: 'FREE_MARGIN_NEGATIVE', reason: `Free margin ${account.freeMargin.toFixed(2)}. Nuevas entradas bloqueadas.` })
  } else if (health.blockNewEntries) {
    pushActivity({ action: 'TRADE_BLOCKED_MARGIN', reason: health.reasons.join(' ') })
  }
  let effectiveness = buildAgentEffectiveness({ account, activityFeed, blockedOpportunities: lastBlocked, openPositions: getOpenPositions() })
  if ((effectiveness.status === 'CORRECTIVE' || effectiveness.status === 'WEAK' || effectiveness.status === 'INEFFICIENT') && getMicroProfitStatus().targetNetUsd < 2) {
    setMicroProfitTargetNetUsd(2)
    pushActivity({ action: 'MICRO_TARGET_AUTO_RESTORE', reason: 'Modo correctivo: target $1 genera churn; se restaura target neto recomendado $2.' })
  }
  emitEffectivenessEvents(effectiveness, account)
  const adaptiveLearning = buildAdaptiveLearning()
  const researchLearning = maybeRunCfdResearchLearning('agent-cycle')
  if (researchLearning.lastRunAt && researchLearning.lastRunAt !== lastResearchLearningRunAt) {
    lastResearchLearningRunAt = researchLearning.lastRunAt
    pushActivity({
      action: researchLearning.status === 'READY' ? 'GPT_RESEARCH_LEARNING' : 'GPT_RESEARCH_WARNING',
      reason: researchLearning.summary,
    })
  }
  const learningSignature = `${adaptiveLearning.status}:${adaptiveLearning.mainProblem}:${adaptiveLearning.rules.map((rule) => `${rule.action}:${rule.target ?? 'global'}`).join('|')}`
  if (learningSignature !== lastLearningSignature) {
    lastLearningSignature = learningSignature
    pushActivity({ action: 'LEARNING_UPDATE', reason: `${adaptiveLearning.status}: ${adaptiveLearning.mainLesson}` })
    if (adaptiveLearning.rules.length) pushActivity({ action: 'LEARNING_RULE_APPLIED', reason: adaptiveLearning.rules[0].solution })
  }

  const scan = await scanGlobalOpportunities()
  lastOpportunities = scan.opportunities
  lastBlocked = scan.blocked
  const learningCampaignEvents = await updateWeekendLearningCampaign(scan.opportunities)
  for (const event of learningCampaignEvents) pushActivity(event)
  if (learningCampaignEvents.length) {
    const campaign = getWeekendLearningCampaignStatus()
    pushActivity({
      action: 'LEARNING_CAMPAIGN_PROGRESS',
      reason: `Campana shadow ${campaign.completedSamples}/${campaign.targetSamples}; abiertas ${campaign.openSamples}; no afecta balance ni margen.`,
    })
  }
  effectiveness = buildAgentEffectiveness({ account, activityFeed, blockedOpportunities: lastBlocked, openPositions: getOpenPositions() })
  const best = scan.opportunities[0]
  const rotation = reviewOpenPositions({ account, accountHealth: health.accountHealth, opportunities: scan.opportunities, positions: getOpenPositions() })
  let traderSkill = buildCfdTraderSkillReadout({
    account,
    actionsTaken: lastTraderSkillActionsTaken,
    blockedActions: lastTraderSkillBlockedActions,
    effectiveness,
    opportunities: scan.opportunities,
    positions: getOpenPositions(),
  })
  const skillExecution = executeTraderSkillActions({ readout: traderSkill, rotation })
  traderSkill = buildCfdTraderSkillReadout({
    account: accountSnapshot(),
    actionsTaken: skillExecution.actionsTaken,
    blockedActions: skillExecution.blockedActions,
    effectiveness: buildAgentEffectiveness({ account: accountSnapshot(), activityFeed, blockedOpportunities: lastBlocked, openPositions: getOpenPositions() }),
    opportunities: scan.opportunities,
    positions: getOpenPositions(),
  })
  const recycle = evaluateCapitalRecycling({ bestOpportunity: best ?? null, costToSwitch: rotation.weakestPosition?.position.totalEstimatedCost ?? 0, weakestPosition: rotation.weakestPosition })
  if (rotation.weakestPosition) {
    pushActivity({ action: 'POSITION_REVIEW', symbol: rotation.weakestPosition.position.cfdSymbol, reason: rotation.weakestPosition.reason })
  }
  const activeRecycle = !defensiveDiagnostic.active && defensiveDiagnostic.mode !== 'RECOVERY_PROBE_MODE' && rotation.weakestPosition?.action === 'REPLACE' && recycle.approved
  if (rotation.weakestPosition && (health.needsMarginRelease || activeRecycle) && (rotation.weakestPosition.action === 'CLOSE' || rotation.weakestPosition.action === 'REPLACE' || getOpenPositions().length > health.maxAllowedOpenPositions)) {
    closeWeakPosition(rotation.weakestPosition, activeRecycle ? 'CAPITAL_RECYCLE' : 'POSITION_CLOSE_WEAK')
    account = accountSnapshot()
    health = evaluateAccountHealth(account, getOpenPositions())
  }
  lastTraderDecision = buildTraderDecision({
    accountHealth: health.accountHealth,
    bestOpportunity: best ?? null,
    blockNewEntries: defensiveDiagnostic.active || health.blockNewEntries,
    maxAllowedOpenPositions: health.maxAllowedOpenPositions,
    reason: defensiveDiagnostic.active ? defensiveDiagnostic.reason : health.reasons.join(' ') || (recycle.approved ? recycle.reason : 'Cuenta sana; el agente puede evaluar nuevas entradas con disciplina.'),
    weakestPosition: rotation.weakestPosition,
  })
  if (!best) {
    agentStatus = getOpenPositions().length ? 'MANAGING' : 'WATCHING'
    lastDecision = { decision: 'WAITING_FOR_DATA', reason: 'Sin oportunidad con feed vivo por ahora.' }
    pushActivity({ action: 'SCAN', reason: 'Sin oportunidad valida; sigue buscando.' })
    return
  }
  pushActivity({ action: 'SCAN', symbol: best.cfdSymbol, reason: `${best.opportunityScore.toFixed(0)} - ${best.reason}` })
  let openedCount = 0
  let attemptedOrBlocked = false
  if (defensiveDiagnostic.active) {
    attemptedOrBlocked = true
    const lossAttribution = buildLossAttribution()
    lastDecision = { decision: 'STOP_NEW_ENTRIES', mode: defensiveDiagnostic.mode, reason: defensiveDiagnostic.reason, symbol: best.cfdSymbol }
    pushActivity({ action: 'STOP_NEW_ENTRIES', symbol: best.cfdSymbol, reason: defensiveDiagnostic.reason })
    pushActivity({ action: 'LOSS_ATTRIBUTION_REPORT', reason: `Driver probable: ${lossAttribution.mainLossDriver}. ${lossAttribution.recommendations[0]}` })
  } else if (traderSkill.executableActions.some((action) => action.type === 'BLOCK_NEW_ENTRIES')) {
    attemptedOrBlocked = true
    lastDecision = { decision: 'BLOCK', reason: traderSkill.riskWarning, symbol: best.cfdSymbol }
    pushActivity({ action: 'BLOCK_BY_TRADER_DEFENSIVE_MODE', symbol: best.cfdSymbol, reason: traderSkill.riskWarning })
  } else if (effectiveness.status === 'INEFFICIENT' && account.closedPnl <= -getMicroProfitStatus().limits.dailyStopLossUsd) {
    attemptedOrBlocked = true
    lastDecision = { decision: 'BLOCK', reason: effectiveness.reason, symbol: best.cfdSymbol }
    pushActivity({ action: 'EFFECTIVENESS_WEAK', symbol: best.cfdSymbol, reason: effectiveness.reason })
  } else if (health.blockNewEntries) {
    attemptedOrBlocked = true
    lastDecision = { decision: 'BLOCK', reason: health.reasons.join(' '), symbol: best.cfdSymbol }
    pushActivity({ action: 'TRADE_BLOCKED_MARGIN', symbol: best.cfdSymbol, reason: health.reasons.join(' ') })
  } else {
    const performanceGuard = getPerformanceGuardStatus()
    if (performanceGuard.status !== 'APPROVED') {
      attemptedOrBlocked = true
      lastDecision = { decision: 'BLOCK', reason: performanceGuard.reason, symbol: best.cfdSymbol }
      pushActivity({ action: 'TRADE_BLOCKED_SAMPLE_SIZE', symbol: best.cfdSymbol, reason: performanceGuard.reason })
    }
  }
  const recoveryMode = isRecoveryMode(effectiveness)
  const recoveryMarginLocked = recoveryMode && (account.marginLevel < 140 || account.freeMargin < account.equity * 0.1)
  if (recoveryMarginLocked) {
    attemptedOrBlocked = true
    lastDecision = { decision: 'BLOCK', reason: 'Modo recovery: margen comprimido. No se abren entradas hasta recuperar margin level > 140% y free margin > 10%.', symbol: best.cfdSymbol }
    pushActivity({ action: 'RECOVERY_MARGIN_LOCK', symbol: best.cfdSymbol, reason: String(lastDecision.reason) })
  }
  if (!defensiveDiagnostic.active && !health.blockNewEntries && !recoveryMarginLocked && getPerformanceGuardStatus().status === 'APPROVED') {
    const openSymbols = new Set(getOpenPositions().map((position) => position.cfdSymbol))
    const recoveryBlocked: Array<{ cfdSymbol: string; reason: string }> = []
    const candidates: Opportunity[] = []
    for (const rawOpportunity of scan.opportunities) {
      if (openSymbols.has(rawOpportunity.cfdSymbol)) continue
      const probe = defensiveDiagnostic.mode === 'RECOVERY_PROBE_MODE'
        ? buildControlledProbeOpportunity({ account, openPositions: getOpenPositions(), opportunity: rawOpportunity })
        : { approved: rawOpportunity.setupConfirmed && rawOpportunity.opportunityScore >= 85, opportunity: rawOpportunity, reason: 'Setup confirmado.' }
      if (!probe.approved) {
        recoveryBlocked.push({ cfdSymbol: rawOpportunity.cfdSymbol, reason: probe.reason })
        continue
      }
      const opportunity = probe.opportunity
      if (!opportunity.setupConfirmed || opportunity.opportunityScore < 85) {
        recoveryBlocked.push({ cfdSymbol: opportunity.cfdSymbol, reason: `Setup/score insuficiente: ${opportunity.setupStatus}, score ${opportunity.opportunityScore.toFixed(0)}.` })
        continue
      }
      const probeMinScore = opportunity.source === 'BINANCE_REALTIME' || opportunity.assetClass === 'CRYPTO_CFD' ? 86 : 90
      const probeMinCfdScore = opportunity.setupStatus === 'CONTROLLED_PROBE'
        ? opportunity.assetClass === 'CRYPTO_CFD' ? 85 : 82
        : opportunity.source === 'BINANCE_REALTIME' || opportunity.assetClass === 'CRYPTO_CFD' ? 87 : 88
      if (defensiveDiagnostic.mode === 'RECOVERY_PROBE_MODE' && ((opportunity.opportunityScore ?? 0) < probeMinScore || (opportunity.cfdExpertScore ?? 0) < probeMinCfdScore)) {
        recoveryBlocked.push({ cfdSymbol: opportunity.cfdSymbol, reason: `Recovery probe exige score >= ${probeMinScore} y CFD score >= ${probeMinCfdScore}. Score ${opportunity.opportunityScore.toFixed(0)}, CFD ${(opportunity.cfdExpertScore ?? 0).toFixed(0)}.` })
        continue
      }
      const traderGate = validateTraderEntryGate({ account, effectiveness, openPositions: getOpenPositions(), opportunity })
      if (!traderGate.approved) {
        recoveryBlocked.push({ cfdSymbol: opportunity.cfdSymbol, reason: traderGate.reason })
        continue
      }
      const recovery = validateRecoveryCandidate({ effectiveness, opportunity })
      if (!recovery.approved) {
        recoveryBlocked.push({ cfdSymbol: opportunity.cfdSymbol, reason: recovery.reason })
        continue
      }
      if (opportunity.setupStatus === 'CONTROLLED_PROBE') pushActivity({ action: 'CONTROLLED_PROBE_APPROVED', symbol: opportunity.cfdSymbol, reason: probe.reason })
      if (recoveryMode) pushActivity({ action: 'RECOVERY_SNIPER_APPROVED', symbol: opportunity.cfdSymbol, reason: recovery.reason })
      candidates.push(opportunity)
    }
    if (recoveryBlocked.length) {
      lastBlocked = [...lastBlocked, ...recoveryBlocked]
      for (const blocked of recoveryBlocked.slice(0, 3)) pushActivity({ action: 'BLOCK_BY_RECOVERY_GUARD', symbol: blocked.cfdSymbol, reason: blocked.reason })
    }
    if (!candidates.length && getOpenPositions().length) {
      attemptedOrBlocked = true
      lastDecision = recoveryMode
        ? { decision: 'MANAGE', reason: 'Modo recovery: no hay entrada sniper suficientemente fuerte; gestionar abiertas y evitar repetir patron perdedor.', symbol: best.cfdSymbol }
        : { decision: 'MANAGE', reason: 'Todos los setups aprobados ya tienen posicion abierta; gestionar sin duplicar ni contaminar el monitor con bloqueos falsos.', symbol: best.cfdSymbol }
      pushActivity({ action: 'MANAGE_EXISTING_POSITIONS', reason: String(lastDecision.reason) })
    } else if (!candidates.length) {
      attemptedOrBlocked = true
      const confirmedCount = scan.opportunities.filter((opportunity) => opportunity.setupConfirmed).length
      const reason = confirmedCount
        ? `Agente corriendo, pero ninguna oportunidad confirmada supera todos los filtros de recovery/trader gate. Mejor lectura: ${best.cfdSymbol} ${best.setupStatus}, score ${best.opportunityScore.toFixed(0)}, CFD ${(best.cfdExpertScore ?? 0).toFixed(0)}.`
        : `Agente corriendo y escaneando; todavia no hay setup CONFIRMED. Mejor lectura: ${best.cfdSymbol} ${best.setupStatus}, score ${best.opportunityScore.toFixed(0)}, CFD ${(best.cfdExpertScore ?? 0).toFixed(0)}.`
      lastDecision = { decision: 'WAIT_FOR_CONFIRMED_SETUP', reason, symbol: best.cfdSymbol }
      pushActivity({ action: 'WAIT_FOR_CONFIRMED_SETUP', symbol: best.cfdSymbol, reason })
    }
    for (const opportunity of candidates) {
      account = accountSnapshot()
      health = evaluateAccountHealth(account, getOpenPositions())
      const allowedSlots = defensiveDiagnostic.mode === 'RECOVERY_PROBE_MODE'
        ? Math.min(defensiveDiagnostic.maxReactivationOpenPositions, health.maxAllowedOpenPositions)
        : Math.min(tradingConfig.maxOpenPositions, health.maxAllowedOpenPositions)
      if (health.blockNewEntries || getOpenPositions().length >= allowedSlots) {
        attemptedOrBlocked = true
        pushActivity({ action: 'TRADE_BLOCKED_MARGIN', symbol: opportunity.cfdSymbol, reason: health.reasons.join(' ') || `Max permitido ahora: ${allowedSlots}.` })
        break
      }
      const opened = await openCfdPaperPosition(opportunity, false, defensiveDiagnostic.mode === 'RECOVERY_PROBE_MODE'
        ? { maxLeverage: defensiveDiagnostic.maxReactivationLeverage, maxRiskUsd: defensiveDiagnostic.reactivationRiskUsd }
        : {})
      attemptedOrBlocked = true
      lastDecision = { decision: opened.opened ? 'OPEN' : 'BLOCK', reason: opened.reason, symbol: opportunity.cfdSymbol }
      const action = opened.opened
        ? opportunity.setupStatus === 'CONTROLLED_PROBE'
          ? 'OPEN_CONTROLLED_PROBE_CFD_PAPER'
          : opportunity.source === 'VT_MARKETS_MT5_DEMO' ? 'OPEN_VT_CFD_PAPER' : 'OPEN_BINANCE_CFD_PAPER'
        : 'BLOCK_BY_PORTFOLIO_POLICY'
      pushActivity({ action, symbol: opportunity.cfdSymbol, reason: opened.reason })
      if (opened.opened) openedCount += 1
    }
  }
  if (!openedCount && !attemptedOrBlocked) {
    lastDecision = { decision: 'WATCH', reason: best.reason, symbol: best.cfdSymbol }
  }
  agentStatus = getOpenPositions().length ? 'MANAGING' : 'WATCHING'
}

async function safeEvaluateAgentCycle() {
  try {
    await evaluateAgentCycle()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    lastEvaluationAt = new Date().toISOString()
    nextEvaluationAt = new Date(Date.now() + tradingConfig.agentIntervalMs).toISOString()
    lastDecision = { decision: 'WAIT', reason: `Ciclo pausado por error temporal de feed: ${reason}` }
    pushActivity({ action: 'FEED_WARNING', reason: `Error temporal de feed; el agente sigue vivo. ${reason}` })
    agentStatus = getOpenPositions().length ? 'MANAGING' : 'WATCHING'
  }
}

export function startCfdPaperAgent() {
  if (loop) return
  agentStatus = 'RUNNING'
  void safeEvaluateAgentCycle()
  loop = setInterval(() => void safeEvaluateAgentCycle(), tradingConfig.agentIntervalMs)
}

function stopCfdPaperAgent() {
  if (loop) clearInterval(loop)
  loop = undefined
  agentStatus = 'STOPPED'
  lastDecision = { decision: 'STOPPED', reason: 'Agente CFD paper detenido por usuario.' }
}

async function statusPayload() {
  await updatePositionsForStatus()
  const openPositions = getOpenPositions()
  const account = accountSnapshot()
  const health = evaluateAccountHealth(account, openPositions)
  const fallbackRotation = reviewOpenPositions({ account, accountHealth: health.accountHealth, opportunities: lastOpportunities, positions: openPositions })
  const traderDecision = lastTraderDecision ?? buildTraderDecision({
    accountHealth: health.accountHealth,
    bestOpportunity: lastOpportunities[0] ?? null,
    blockNewEntries: health.blockNewEntries,
    maxAllowedOpenPositions: health.maxAllowedOpenPositions,
    reason: health.reasons.join(' ') || 'Cuenta sana; el agente puede operar con disciplina.',
    weakestPosition: fallbackRotation.weakestPosition,
  })
  const [vtStatus, vtAccount, vtSymbols] = await Promise.all([
    getVtMarketsStatus(),
    getVtAccount(),
    getVtSymbols(),
  ])
  const agentEffectiveness = buildAgentEffectiveness({
    account,
    activityFeed,
    blockedOpportunities: lastBlocked,
    openPositions,
  })
  const defensiveDiagnostic = getDefensiveDiagnosticMode(account)
  const lossAttribution = buildLossAttribution()
  const targetFeasibility = buildTargetFeasibility()
  const leverageDamage = buildLeverageDamage()
  const adaptiveLearning = buildAdaptiveLearning()
  const cfdResearchLearning = getCfdResearchLearningStatus()
  const learningCampaign = getWeekendLearningCampaignStatus()
  const cfdTraderSkill = buildCfdTraderSkillReadout({
    account,
    actionsTaken: lastTraderSkillActionsTaken,
    blockedActions: lastTraderSkillBlockedActions,
    effectiveness: agentEffectiveness,
    opportunities: lastOpportunities,
    positions: openPositions,
  })
  return {
    mode: defensiveDiagnostic.mode === 'RECOVERY_PROBE_MODE'
      ? 'RECOVERY_PROBE_MODE'
      : defensiveDiagnostic.active
        ? 'DEFENSIVE_DIAGNOSTIC_MODE'
        : 'CFD_PAPER_TRADING_MODE',
    paperOnly: true,
    realTradingAllowed: false,
    brokerExecutionEnabled: false,
    multiSourceTrading: true,
    limits: {
      baseMaxOpenPositions: multiPositionLimits.maxTotalOpenPositions,
      maxBinanceCryptoOpenPositions: multiPositionLimits.maxBinanceCryptoOpenPositions,
      maxTotalOpenPositions: multiPositionLimits.maxTotalOpenPositions,
      maxVtOpenPositions: multiPositionLimits.maxVtOpenPositions,
    },
    sources: {
      vtMarkets: {
        enabledForPaperSignals: vtStatus.status === 'CONNECTED_DEMO_READ_ONLY',
        openPositions: openPositions.filter((position) => position.source === 'VT_MARKETS_MT5_DEMO').length,
        status: vtStatus.status === 'CONNECTED_DEMO_READ_ONLY' ? 'CONNECTED_DEMO_READ_ONLY' : 'NOT_CONNECTED',
      },
      binance: {
        enabledForPaperSignals: getFeedStatuses().binance.status === 'CONNECTED',
        openPositions: openPositions.filter((position) => position.source === 'BINANCE_REALTIME' || position.assetClass === 'CRYPTO_CFD').length,
        status: getFeedStatuses().binance.status,
      },
    },
    agent: {
      status: agentStatus,
      workerRunning: Boolean(loop),
      lastEvaluationAt,
      nextEvaluationAt,
      lastDecision,
    },
    account,
    openPositions,
    opportunities: lastOpportunities.map((opportunity) => ({
      cfdSymbol: opportunity.cfdSymbol,
      underlyingSymbol: opportunity.underlyingSymbol,
      score: opportunity.opportunityScore,
      strategy: opportunity.strategy,
      timeframe: opportunity.timeframe,
      setupStatus: opportunity.setupStatus,
      cfdExpertDecision: getLastCfdExpertEvaluation()?.cfdSymbol === opportunity.cfdSymbol ? getLastCfdExpertEvaluation()?.decision : 'WATCH',
      direction: opportunity.direction,
      reason: opportunity.reason,
      provider: opportunity.quote.provider,
      feedType: opportunity.quote.feedType,
      source: opportunity.source ?? (opportunity.assetClass === 'CRYPTO_CFD' ? 'BINANCE_REALTIME' : 'VT_MARKETS_MT5_DEMO'),
      assetClass: opportunity.assetClass,
      spread: opportunity.quote.spread,
      spreadBps: opportunity.quote.spreadBps,
      price: opportunity.quote.mid,
      decision: opportunity.decision ?? 'WATCH',
      cfdExpertScore: opportunity.cfdExpertScore ?? opportunity.opportunityScore,
      riskReward: opportunity.riskReward ?? 2.1,
      expectedNetProfit: opportunity.expectedNetProfit ?? 0,
      candleBehavior: opportunity.candleBehavior,
      candleBehaviorScore: opportunity.candleBehaviorScore,
      candlePattern: opportunity.candlePattern,
      learningAdjustedScore: opportunity.learningAdjustedScore,
      learningBias: opportunity.learningBias,
      learningReason: opportunity.learningReason,
    })),
    blockedOpportunities: lastBlocked,
    activityFeed,
    feeds: getFeedStatuses(),
    cfdExpert: {
      enabled: true,
      mode: 'PAPER_ONLY',
      lastEvaluation: getLastCfdExpertEvaluation(),
    },
    performance: getPerformanceSummary(),
    microProfit: microProfitSnapshot(),
    agentEffectiveness,
    defensiveDiagnostic,
    lossAttribution,
    targetFeasibility,
    leverageDamage,
    adaptiveLearning,
    cfdResearchLearning,
    learningCampaign,
    cfdTraderSkill,
    traderDecision,
    vtMarkets: {
      ...vtStatus,
      account: {
        balance: vtAccount.balance,
        equity: vtAccount.equity,
        freeMargin: vtAccount.freeMargin,
        marginLevel: vtAccount.marginLevel,
        usedMargin: vtAccount.usedMargin,
      },
      symbolsMapped: vtSymbols.length,
    },
    safety: {
      ...getSafetyConfig(),
      realTradingAllowed: false,
      brokerExecutionEnabled: false,
      killSwitchStatus: getKillSwitchStatus().status,
    },
    serverTime: new Date().toISOString(),
  }
}

cfdPaperRouter.get('/status', async (_request, response) => {
  response.json(await statusPayload())
})

cfdPaperRouter.post('/start-agent', (_request, response) => {
  startCfdPaperAgent()
  response.json({ ok: true, status: agentStatus, realTradingAllowed: false })
})

cfdPaperRouter.post('/micro-profit-target', (request, response) => {
  const target = setMicroProfitTargetNetUsd(Number(request.body?.targetNetUsd))
  response.json({ ok: true, microProfit: microProfitSnapshot(), targetNetUsd: target, realTradingAllowed: false, brokerExecutionEnabled: false })
})

cfdPaperRouter.post('/activate-defensive-diagnostic', (_request, response) => {
  activateDefensiveDiagnosticMode('Activado manualmente por perdidas persistentes reportadas por el usuario.')
  diagnosticModeAnnounced = false
  lastDecision = { decision: 'STOP_NEW_ENTRIES', mode: 'DEFENSIVE_DIAGNOSTIC_MODE', reason: 'Nuevas entradas bloqueadas hasta diagnosticar edge.' }
  pushActivity({ action: 'DEFENSIVE_DIAGNOSTIC_ON', reason: 'Modo diagnostico defensivo activado manualmente.' })
  response.json({ ok: true, defensiveDiagnostic: getDefensiveDiagnosticMode(accountSnapshot()), realTradingAllowed: false, brokerExecutionEnabled: false })
})

cfdPaperRouter.post('/activate-recovery-probe', (_request, response) => {
  activateRecoveryProbeMode('Punto medio activo: max 2 posiciones, risk $10, leverage maximo 10x y entradas solo con setup fuerte.')
  diagnosticModeAnnounced = false
  lastDecision = { decision: 'RECOVERY_PROBE_MODE', mode: 'RECOVERY_PROBE_MODE', reason: 'Entradas paper limitadas para medir edge sin modo agresivo.' }
  pushActivity({ action: 'RECOVERY_PROBE_ON', reason: 'Modo intermedio activado: risk $10, entradas limitadas, gating mas inteligente y sin dinero real.' })
  response.json({ ok: true, defensiveDiagnostic: getDefensiveDiagnosticMode(accountSnapshot()), realTradingAllowed: false, brokerExecutionEnabled: false })
})

cfdPaperRouter.post('/run-research-learning', async (_request, response) => {
  const research = await runCfdResearchLearningNow('manual')
  if (research.lastRunAt && research.lastRunAt !== lastResearchLearningRunAt) {
    lastResearchLearningRunAt = research.lastRunAt
    pushActivity({
      action: research.status === 'READY' ? 'GPT_RESEARCH_LEARNING' : 'GPT_RESEARCH_WARNING',
      reason: research.summary,
    })
  }
  response.json({ ok: true, cfdResearchLearning: research, realTradingAllowed: false, brokerExecutionEnabled: false })
})

cfdPaperRouter.post('/stop-agent', (_request, response) => {
  stopCfdPaperAgent()
  response.json({ ok: true, status: agentStatus, realTradingAllowed: false })
})

cfdPaperRouter.post('/open-test-position', async (request, response) => {
  const symbol = String(request.body?.symbol ?? 'BTCUSD.cfd')
  const quote = await getCfdQuote(symbol)
  const opportunity: Opportunity = {
    cfdSymbol: quote.cfdSymbol,
    underlyingSymbol: quote.underlyingSymbol,
    assetClass: quote.cfdSymbol.includes('USD') ? 'CRYPTO_CFD' : 'UNKNOWN',
    opportunityScore: 99,
    strategy: 'RealtimeFeedTest',
    timeframe: 'INTRADAY_SLOW',
    setupStatus: 'CONFIRMED',
    setupConfirmed: true,
    reason: 'Posicion paper test solicitada desde UI. No envia orden real.',
    quote,
  }
  const result = await openCfdPaperPosition(opportunity, true)
  pushActivity({ action: result.opened ? 'OPEN_TEST' : 'BLOCK_TEST', symbol: quote.cfdSymbol, reason: result.reason })
  response.json({ ...result, status: await statusPayload() })
})

cfdPaperRouter.post('/close-position', (request, response) => {
  const id = String(request.body?.id ?? '')
  const position = getOpenPositions().find((item) => item.id === id)
  if (!position) {
    response.status(404).json({ ok: false, reason: 'Posicion no encontrada.' })
    return
  }
  const closed = closePosition(id, position.currentPrice, 'USER_PAPER_CLOSE')
  pushActivity({ action: 'CLOSE', symbol: position.cfdSymbol, reason: 'Cierre paper manual desde UI.', pnl: closed?.pnl })
  response.json({ ok: true, closed })
})
