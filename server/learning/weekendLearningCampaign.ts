import fs from 'node:fs'
import path from 'node:path'
import { getCfdQuote } from '../cfd/cfdPricingEngine.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'

type ShadowPosition = {
  id: string
  cfdSymbol: string
  source: string
  assetClass: string
  direction: 'LONG' | 'SHORT'
  strategy: string
  entryPrice: number
  positionSize: number
  spreadAtEntry: number
  totalEstimatedCost: number
  openedAt: string
  lastPriceUpdate: string
  score: number
  cfdExpertScore: number
  reason: string
}

type ShadowClosedSample = ShadowPosition & {
  closedAt: string
  exitPrice: number
  exitReason: 'TARGET_2_USD' | 'MAX_LOSS' | 'TIME_SAMPLE' | 'STALE_PRICE'
  grossPnl: number
  netPnl: number
  holdSeconds: number
}

type CampaignState = {
  startedAt: string
  openSamples: ShadowPosition[]
  closedSamples: ShadowClosedSample[]
  lastUpdatedAt: string
  lastDecision: string
}

export type LearningCampaignEvent = {
  action: string
  reason: string
  symbol?: string
  pnl?: number
}

const dataDir = path.join(process.cwd(), 'data')
const statePath = path.join(dataDir, 'weekend-learning-campaign.json')

function boolEnv(name: string, fallback: boolean) {
  const value = process.env[name]
  if (value === undefined) return fallback
  return value.toLowerCase() === 'true'
}

function numEnv(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

export const weekendLearningCampaignConfig = {
  enabled: boolEnv('WEEKEND_LEARNING_CAMPAIGN_ENABLED', false),
  targetSamples: numEnv('WEEKEND_LEARNING_CAMPAIGN_TARGET_SAMPLES', 200),
  maxConcurrentSamples: numEnv('WEEKEND_LEARNING_CAMPAIGN_MAX_CONCURRENT', 12),
  minScore: numEnv('WEEKEND_LEARNING_CAMPAIGN_MIN_SCORE', 60),
  minCfdExpertScore: numEnv('WEEKEND_LEARNING_CAMPAIGN_MIN_CFD_SCORE', 60),
  targetNetUsd: numEnv('WEEKEND_LEARNING_CAMPAIGN_TARGET_NET_USD', 2),
  maxLossUsd: numEnv('WEEKEND_LEARNING_CAMPAIGN_MAX_LOSS_USD', 10),
  maxHoldSeconds: numEnv('WEEKEND_LEARNING_CAMPAIGN_MAX_HOLD_SECONDS', 120),
  maxShadowNotionalUsd: numEnv('WEEKEND_LEARNING_CAMPAIGN_MAX_SHADOW_NOTIONAL_USD', 25_000),
}

function blankState(): CampaignState {
  const now = new Date().toISOString()
  return {
    startedAt: now,
    openSamples: [],
    closedSamples: [],
    lastUpdatedAt: now,
    lastDecision: weekendLearningCampaignConfig.enabled
      ? 'Campana shadow lista: recolectar muestras paper sin tocar balance ni margen.'
      : 'Campana shadow desactivada.',
  }
}

function loadState(): CampaignState {
  try {
    if (!fs.existsSync(statePath)) return blankState()
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8')) as Partial<CampaignState>
    return {
      startedAt: parsed.startedAt ?? new Date().toISOString(),
      openSamples: Array.isArray(parsed.openSamples) ? parsed.openSamples : [],
      closedSamples: Array.isArray(parsed.closedSamples) ? parsed.closedSamples : [],
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString(),
      lastDecision: parsed.lastDecision ?? 'Campana shadow cargada.',
    }
  } catch {
    return blankState()
  }
}

let state = loadState()

function saveState() {
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(statePath, JSON.stringify({
    ...state,
    openSamples: state.openSamples.slice(0, 50),
    closedSamples: state.closedSamples.slice(0, 600),
  }, null, 2))
}

function sampleMoveBps(assetClass: string) {
  if (assetClass === 'FOREX_CFD') return 3
  if (assetClass === 'INDEX_CFD') return 4.5
  if (assetClass === 'METAL_CFD') return 5
  if (assetClass === 'CRYPTO_CFD') return 40
  return 8
}

function isUsableFeed(opportunity: Opportunity) {
  return ['BROKER_DEMO_REALTIME', 'REALTIME_TICK', 'DELAYED_INTRADAY'].includes(opportunity.quote.feedType)
    && opportunity.quote.bid > 0
    && opportunity.quote.ask > opportunity.quote.bid
}

function buildShadowPosition(opportunity: Opportunity): ShadowPosition | null {
  const direction = opportunity.direction ?? 'LONG'
  const entryPrice = direction === 'LONG' ? opportunity.quote.ask : opportunity.quote.bid
  const targetMove = entryPrice * sampleMoveBps(opportunity.assetClass) / 10_000
  const netMovePerUnit = targetMove - Math.abs(opportunity.quote.spread) * 1.5
  if (!Number.isFinite(netMovePerUnit) || netMovePerUnit <= 0) return null
  const maxSizeByNotional = weekendLearningCampaignConfig.maxShadowNotionalUsd / entryPrice
  const targetSize = weekendLearningCampaignConfig.targetNetUsd / netMovePerUnit
  const positionSize = Math.max(0, Math.min(targetSize, maxSizeByNotional))
  if (!Number.isFinite(positionSize) || positionSize <= 0) return null
  const spreadCost = Math.abs(opportunity.quote.spread * positionSize)
  const slippageEstimate = spreadCost * 0.5
  const totalEstimatedCost = spreadCost + slippageEstimate
  if (totalEstimatedCost > weekendLearningCampaignConfig.targetNetUsd * 0.8) return null
  return {
    id: `shadow_${opportunity.cfdSymbol}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    cfdSymbol: opportunity.cfdSymbol,
    source: opportunity.source ?? (opportunity.assetClass === 'CRYPTO_CFD' ? 'BINANCE_REALTIME' : 'VT_MARKETS_MT5_DEMO'),
    assetClass: opportunity.assetClass,
    direction,
    strategy: opportunity.strategy,
    entryPrice,
    positionSize: Number(positionSize.toFixed(8)),
    spreadAtEntry: opportunity.quote.spread,
    totalEstimatedCost: Number(totalEstimatedCost.toFixed(6)),
    openedAt: new Date().toISOString(),
    lastPriceUpdate: opportunity.quote.lastPriceUpdate,
    score: Number(opportunity.opportunityScore.toFixed(2)),
    cfdExpertScore: opportunity.cfdExpertScore ?? opportunity.opportunityScore,
    reason: opportunity.reason,
  }
}

function netPnlFor(position: ShadowPosition, exitPrice: number) {
  const gross = position.direction === 'LONG'
    ? (exitPrice - position.entryPrice) * position.positionSize
    : (position.entryPrice - exitPrice) * position.positionSize
  const net = gross - position.totalEstimatedCost
  return { grossPnl: Number(gross.toFixed(6)), netPnl: Number(net.toFixed(6)) }
}

async function updateOpenSamples() {
  const events: LearningCampaignEvent[] = []
  const nextOpen: ShadowPosition[] = []
  const nowMs = Date.now()
  for (const position of state.openSamples) {
    try {
      const quote = await getCfdQuote(position.cfdSymbol)
      const exitPrice = position.direction === 'LONG' ? quote.bid : quote.ask
      const ageSeconds = Math.max(0, (nowMs - new Date(position.openedAt).getTime()) / 1000)
      if (!Number.isFinite(exitPrice) || exitPrice <= 0) {
        if (ageSeconds >= weekendLearningCampaignConfig.maxHoldSeconds) {
          const closed = closeSample(position, position.entryPrice, 'STALE_PRICE', ageSeconds)
          events.push({ action: 'LEARNING_SAMPLE_STALE', symbol: position.cfdSymbol, reason: 'Muestra shadow cerrada por precio no disponible.', pnl: closed.netPnl })
        } else {
          nextOpen.push(position)
        }
        continue
      }
      const pnl = netPnlFor(position, exitPrice)
      const shouldClose = pnl.netPnl >= weekendLearningCampaignConfig.targetNetUsd
        || pnl.netPnl <= -weekendLearningCampaignConfig.maxLossUsd
        || ageSeconds >= weekendLearningCampaignConfig.maxHoldSeconds
      if (!shouldClose) {
        nextOpen.push({ ...position, lastPriceUpdate: quote.lastPriceUpdate })
        continue
      }
      const exitReason = pnl.netPnl >= weekendLearningCampaignConfig.targetNetUsd
        ? 'TARGET_2_USD'
        : pnl.netPnl <= -weekendLearningCampaignConfig.maxLossUsd
          ? 'MAX_LOSS'
          : 'TIME_SAMPLE'
      const closed = closeSample(position, exitPrice, exitReason, ageSeconds)
      events.push({
        action: exitReason === 'TARGET_2_USD' ? 'LEARNING_SAMPLE_TARGET' : exitReason === 'MAX_LOSS' ? 'LEARNING_SAMPLE_LOSS' : 'LEARNING_SAMPLE_TIME',
        symbol: position.cfdSymbol,
        reason: `Shadow sample cerrada: ${exitReason}, net ${closed.netPnl.toFixed(4)}. No afecta balance ni margen.`,
        pnl: closed.netPnl,
      })
    } catch {
      nextOpen.push(position)
    }
  }
  state.openSamples = nextOpen
  return events
}

function closeSample(position: ShadowPosition, exitPrice: number, exitReason: ShadowClosedSample['exitReason'], holdSeconds: number) {
  const pnl = netPnlFor(position, exitPrice)
  const closed: ShadowClosedSample = {
    ...position,
    closedAt: new Date().toISOString(),
    exitPrice,
    exitReason,
    grossPnl: pnl.grossPnl,
    netPnl: pnl.netPnl,
    holdSeconds: Number(holdSeconds.toFixed(1)),
  }
  state.closedSamples.unshift(closed)
  return closed
}

function openNewSamples(opportunities: Opportunity[]) {
  const events: LearningCampaignEvent[] = []
  const completed = state.closedSamples.length
  const slots = Math.min(
    weekendLearningCampaignConfig.maxConcurrentSamples - state.openSamples.length,
    weekendLearningCampaignConfig.targetSamples - completed,
  )
  if (slots <= 0) return events
  const openSymbols = new Set(state.openSamples.map((item) => item.cfdSymbol))
  const candidates = opportunities
    .filter((opportunity) => isUsableFeed(opportunity))
    .filter((opportunity) => !openSymbols.has(opportunity.cfdSymbol))
    .filter((opportunity) => opportunity.opportunityScore >= weekendLearningCampaignConfig.minScore)
    .filter((opportunity) => (opportunity.cfdExpertScore ?? opportunity.opportunityScore) >= weekendLearningCampaignConfig.minCfdExpertScore)
    .sort((a, b) => (b.learningAdjustedScore ?? b.opportunityScore) - (a.learningAdjustedScore ?? a.opportunityScore))
  for (const opportunity of candidates.slice(0, slots)) {
    const position = buildShadowPosition(opportunity)
    if (!position) continue
    state.openSamples.push(position)
    openSymbols.add(position.cfdSymbol)
    events.push({
      action: 'LEARNING_SAMPLE_OPEN',
      symbol: position.cfdSymbol,
      reason: `Shadow sample abierta para aprender. Score ${position.score.toFixed(0)}, feed ${opportunity.quote.feedType}, target $${weekendLearningCampaignConfig.targetNetUsd}. No afecta balance ni margen.`,
    })
  }
  return events
}

export async function updateWeekendLearningCampaign(opportunities: Opportunity[]) {
  const events: LearningCampaignEvent[] = []
  if (!weekendLearningCampaignConfig.enabled) return events
  events.push(...await updateOpenSamples())
  if (state.closedSamples.length < weekendLearningCampaignConfig.targetSamples) {
    events.push(...openNewSamples(opportunities))
  }
  state.lastUpdatedAt = new Date().toISOString()
  state.lastDecision = state.closedSamples.length >= weekendLearningCampaignConfig.targetSamples
    ? `Objetivo completado: ${state.closedSamples.length}/${weekendLearningCampaignConfig.targetSamples} muestras.`
    : `Recolectando muestras shadow: ${state.closedSamples.length}/${weekendLearningCampaignConfig.targetSamples} cerradas, ${state.openSamples.length} abiertas.`
  saveState()
  return events
}

export function getWeekendLearningCampaignStatus() {
  const closed = state.closedSamples
  const wins = closed.filter((item) => item.netPnl > 0)
  const losses = closed.filter((item) => item.netPnl < 0)
  const targetHits = closed.filter((item) => item.exitReason === 'TARGET_2_USD')
  const netPnl = closed.reduce((sum, item) => sum + item.netPnl, 0)
  const avgHoldSeconds = closed.length ? closed.reduce((sum, item) => sum + item.holdSeconds, 0) / closed.length : null
  return {
    enabled: weekendLearningCampaignConfig.enabled,
    mode: 'WEEKEND_SHADOW_LEARNING_CAMPAIGN',
    targetSamples: weekendLearningCampaignConfig.targetSamples,
    completedSamples: closed.length,
    openSamples: state.openSamples.length,
    remainingSamples: Math.max(0, weekendLearningCampaignConfig.targetSamples - closed.length),
    progressPercent: Number((closed.length / Math.max(1, weekendLearningCampaignConfig.targetSamples) * 100).toFixed(1)),
    maxConcurrentSamples: weekendLearningCampaignConfig.maxConcurrentSamples,
    targetNetUsd: weekendLearningCampaignConfig.targetNetUsd,
    maxLossUsd: weekendLearningCampaignConfig.maxLossUsd,
    netPnl: Number(netPnl.toFixed(6)),
    wins: wins.length,
    losses: losses.length,
    targetHits: targetHits.length,
    winRate: Number((wins.length / Math.max(1, closed.length) * 100).toFixed(1)),
    averageHoldSeconds: avgHoldSeconds === null ? null : Number(avgHoldSeconds.toFixed(1)),
    startedAt: state.startedAt,
    lastUpdatedAt: state.lastUpdatedAt,
    lastDecision: state.lastDecision,
    recentSamples: closed.slice(0, 12).map((sample) => ({
      cfdSymbol: sample.cfdSymbol,
      direction: sample.direction,
      exitReason: sample.exitReason,
      holdSeconds: sample.holdSeconds,
      netPnl: sample.netPnl,
      score: sample.score,
      source: sample.source,
      strategy: sample.strategy,
    })),
    safety: {
      shadowOnly: true,
      affectsMainBalance: false,
      affectsMainMargin: false,
      sendsOrders: false,
      realTradingAllowed: false,
      brokerExecutionEnabled: false,
    },
  }
}
