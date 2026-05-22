import { boolEnv, numEnv } from '../config/env.js'
import { getMicroProfitTargetNetUsd } from '../config/microProfitConfig.js'
import { getSafetyConfig } from '../config/safetyConfig.js'
import { getOpenPositions, getClosedTrades, type ClosedTrade } from '../storage/tradeStore.js'
import { buildAdaptiveLearning } from './adaptiveLearningEngine.js'
import { buildLossAttribution } from './lossAttributionEngine.js'
import { buildTargetFeasibility } from './targetFeasibilityAnalyzer.js'
import { buildLeverageDamage } from './leverageDamageAnalyzer.js'

export type ResearchLearningRuleProposal = {
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  evidence: string
  proposedRule: string
  reason: string
  validationPlan: string
}

export type ResearchLearningStatus = {
  enabled: boolean
  configured: boolean
  model: string
  webSearchEnabled: boolean
  status: 'NOT_CONFIGURED' | 'DISABLED' | 'IDLE' | 'RUNNING' | 'READY' | 'ERROR'
  lastRunAt: string | null
  nextRunAt: string | null
  trigger: string | null
  summary: string
  techniquesResearched: string[]
  hypotheses: string[]
  candleLessons: string[]
  ruleProposals: ResearchLearningRuleProposal[]
  riskWarnings: string[]
  nextExperiment: string
  operationalPolicy: string
  safety: {
    paperOnly: true
    canOpenTrades: false
    canCloseTrades: false
    canSendOrders: false
    realTradingAllowed: false
    brokerExecutionEnabled: false
  }
  error?: string
}

type OpenAiResearchPayload = {
  summary?: string
  techniquesResearched?: string[]
  hypotheses?: string[]
  candleLessons?: string[]
  ruleProposals?: ResearchLearningRuleProposal[]
  riskWarnings?: string[]
  nextExperiment?: string
}

const model = process.env.CFD_RESEARCH_MODEL ?? 'gpt-5.5'
const enabled = boolEnv('CFD_RESEARCH_ENABLED', true)
const webSearchEnabled = boolEnv('CFD_RESEARCH_WEB_SEARCH_ENABLED', true)
const intervalMinutes = Math.max(5, numEnv('CFD_RESEARCH_INTERVAL_MINUTES', 30))
const timeoutMs = Math.max(5_000, numEnv('CFD_RESEARCH_TIMEOUT_MS', 45_000))

let lastStatus: ResearchLearningStatus = buildBaseStatus()
let running: Promise<ResearchLearningStatus> | null = null

function apiKey() {
  return process.env.OPENAI_API_KEY ?? ''
}

function buildBaseStatus(overrides: Partial<ResearchLearningStatus> = {}): ResearchLearningStatus {
  const configured = Boolean(process.env.OPENAI_API_KEY)
  const status = !enabled ? 'DISABLED' : configured ? 'IDLE' : 'NOT_CONFIGURED'
  return {
    enabled,
    configured,
    model,
    webSearchEnabled: enabled && webSearchEnabled,
    status,
    lastRunAt: null,
    nextRunAt: enabled && configured ? new Date(Date.now() + intervalMinutes * 60_000).toISOString() : null,
    trigger: null,
    summary: configured
      ? 'GPT research learning listo para analizar resultados cuando se ejecute.'
      : 'Agrega OPENAI_API_KEY para activar GPT-5.5 como capa de investigacion y aprendizaje. No puede operar ni enviar ordenes.',
    techniquesResearched: [],
    hypotheses: [],
    candleLessons: [],
    ruleProposals: [],
    riskWarnings: [],
    nextExperiment: 'Configurar OPENAI_API_KEY y ejecutar una revision de aprendizaje.',
    operationalPolicy: 'Research only: propone hipotesis; no abre, no cierra y no envia ordenes.',
    safety: {
      paperOnly: true,
      canOpenTrades: false,
      canCloseTrades: false,
      canSendOrders: false,
      realTradingAllowed: false,
      brokerExecutionEnabled: false,
    },
    ...overrides,
  }
}

function recentClosedTrades(trades = getClosedTrades()) {
  return trades.slice(0, 80).map((trade) => ({
    symbol: trade.cfdSymbol,
    source: trade.source ?? 'UNKNOWN',
    assetClass: trade.assetClass ?? 'UNKNOWN',
    direction: trade.direction,
    strategy: trade.strategy,
    pnl: Number(trade.pnl.toFixed(4)),
    grossPnl: Number((trade.grossPnl ?? trade.pnl).toFixed(4)),
    netPnl: Number((trade.netPnl ?? trade.pnl).toFixed(4)),
    spreadCost: Number((trade.spreadCost ?? 0).toFixed(4)),
    totalEstimatedCost: Number((trade.totalEstimatedCost ?? 0).toFixed(4)),
    leverage: trade.leverage,
    riskUsd: trade.riskUsd,
    exitReason: trade.exitReason,
    openedAt: trade.openedAt,
    closedAt: trade.closedAt,
    holdSeconds: Number(Math.max(0, (new Date(trade.closedAt).getTime() - new Date(trade.openedAt).getTime()) / 1000).toFixed(1)),
    candlePatternAtEntry: trade.candlePatternAtEntry ?? null,
    candleBehaviorScoreAtEntry: trade.candleBehaviorScoreAtEntry ?? null,
    cfdExpertScore: trade.cfdExpertScore,
    professionalSkillScore: trade.professionalSkillScore ?? null,
  }))
}

function summarizeBy<T extends ClosedTrade>(items: T[], key: (trade: T) => string) {
  const groups = new Map<string, T[]>()
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item])
  return [...groups.entries()].map(([name, trades]) => {
    const wins = trades.filter((trade) => trade.pnl > 0)
    const losses = trades.filter((trade) => trade.pnl < 0)
    const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0)
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0))
    return {
      name,
      trades: trades.length,
      netPnl: Number(trades.reduce((sum, trade) => sum + trade.pnl, 0).toFixed(4)),
      winRate: Number((wins.length / Math.max(1, trades.length) * 100).toFixed(1)),
      profitFactor: grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? null : 0,
      avgCost: Number((trades.reduce((sum, trade) => sum + (trade.totalEstimatedCost ?? 0), 0) / Math.max(1, trades.length)).toFixed(4)),
    }
  }).sort((a, b) => a.netPnl - b.netPnl)
}

function buildResearchContext() {
  const closed = getClosedTrades()
  const today = new Date().toISOString().slice(0, 10)
  const todayClosed = closed.filter((trade) => trade.closedAt.startsWith(today))
  return {
    systemMode: 'DEMO_PAPER_READ_ONLY',
    hardSafety: {
      ...getSafetyConfig(),
      paperOnly: true,
      realTradingAllowed: false,
      brokerExecutionEnabled: false,
      orderSendAllowed: false,
    },
    target: {
      netUsd: getMicroProfitTargetNetUsd(),
      note: 'El objetivo operativo es encontrar entradas paper con expectativa realista de net +$2 despues de spread/costos, no operar por operar.',
    },
    openPositions: getOpenPositions().map((position) => ({
      symbol: position.cfdSymbol,
      source: position.source ?? 'UNKNOWN',
      direction: position.direction,
      strategy: position.strategy,
      openPnl: Number(position.openPnl.toFixed(4)),
      riskUsd: position.riskUsd,
      leverage: position.leverage,
      marginRequired: Number(position.marginRequired.toFixed(4)),
      candlePatternAtEntry: position.candlePatternAtEntry ?? null,
      cfdExpertScore: position.cfdExpertScore,
      openedAt: position.openedAt,
    })),
    closedTrades: recentClosedTrades(closed),
    diagnostics: {
      adaptiveLearning: buildAdaptiveLearning(),
      lossAttribution: buildLossAttribution(),
      targetFeasibility: buildTargetFeasibility(),
      leverageDamage: buildLeverageDamage(),
      bySymbol: summarizeBy(todayClosed, (trade) => trade.cfdSymbol),
      byStrategy: summarizeBy(todayClosed, (trade) => trade.strategy),
      byCandlePattern: summarizeBy(todayClosed, (trade) => trade.candlePatternAtEntry ?? 'UNKNOWN_CANDLE'),
    },
    instructions: [
      'Busca y contrasta tecnicas de trading CFD, comportamiento de velas, microestructura, spreads, breakout failures, rejection candles y session behavior.',
      'No recomiendes aumentar riesgo como solucion primaria.',
      'No propongas order_send ni trading real.',
      'Convierte la investigacion en hipotesis testeables en paper.',
      'Devuelve solo JSON valido con summary, techniquesResearched, hypotheses, candleLessons, ruleProposals, riskWarnings y nextExperiment.',
    ],
  }
}

function extractResponseText(response: unknown) {
  if (typeof response !== 'object' || !response) return ''
  const record = response as Record<string, unknown>
  if (typeof record.output_text === 'string') return record.output_text
  const output = Array.isArray(record.output) ? record.output : []
  const chunks: string[] = []
  for (const item of output) {
    if (typeof item !== 'object' || !item) continue
    const content = Array.isArray((item as Record<string, unknown>).content) ? (item as Record<string, unknown>).content as unknown[] : []
    for (const part of content) {
      if (typeof part !== 'object' || !part) continue
      const text = (part as Record<string, unknown>).text
      if (typeof text === 'string') chunks.push(text)
    }
  }
  return chunks.join('\n')
}

function parseJsonFromText(text: string): OpenAiResearchPayload {
  const trimmed = text.trim()
  const direct = tryParseJson(trimmed)
  if (direct) return direct
  const match = trimmed.match(/\{[\s\S]*\}/)
  const parsed = match ? tryParseJson(match[0]) : null
  return parsed ?? {}
}

function tryParseJson(text: string): OpenAiResearchPayload | null {
  try {
    return JSON.parse(text) as OpenAiResearchPayload
  } catch {
    return null
  }
}

function normalizeList(value: unknown, fallback: string[] = []) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 8) : fallback
}

function normalizeRuleProposals(value: unknown): ResearchLearningRuleProposal[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 8).map((item) => {
    const record = typeof item === 'object' && item ? item as Record<string, unknown> : {}
    const confidence = record.confidence === 'HIGH' || record.confidence === 'MEDIUM' || record.confidence === 'LOW' ? record.confidence : 'MEDIUM'
    return {
      confidence,
      evidence: typeof record.evidence === 'string' ? record.evidence : 'Evidencia no especificada.',
      proposedRule: typeof record.proposedRule === 'string' ? record.proposedRule : 'Regla propuesta pendiente de validar.',
      reason: typeof record.reason === 'string' ? record.reason : 'Razon no especificada.',
      validationPlan: typeof record.validationPlan === 'string' ? record.validationPlan : 'Probar en paper con muestra minima antes de aplicar.',
    }
  })
}

async function requestOpenAiResearch(trigger: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const body = {
      model,
      input: [
        {
          role: 'system',
          content: 'Eres un research analyst de CFD paper trading. Tu trabajo es investigar, diagnosticar y proponer hipotesis testeables. No puedes abrir trades, cerrar trades, enviar ordenes, ni recomendar dinero real. Responde solo JSON valido.',
        },
        {
          role: 'user',
          content: JSON.stringify(buildResearchContext()),
        },
      ],
      reasoning: { effort: process.env.CFD_RESEARCH_REASONING_EFFORT ?? 'medium' },
      tools: webSearchEnabled ? [{ type: 'web_search_preview' }] : undefined,
      tool_choice: webSearchEnabled ? 'auto' : undefined,
    }
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const responseText = await response.text()
    if (!response.ok) throw new Error(`OpenAI research request failed ${response.status}: ${responseText.slice(0, 400)}`)
    const raw = JSON.parse(responseText) as unknown
    const parsed = parseJsonFromText(extractResponseText(raw))
    const now = new Date().toISOString()
    return buildBaseStatus({
      configured: true,
      status: 'READY',
      lastRunAt: now,
      nextRunAt: new Date(Date.now() + intervalMinutes * 60_000).toISOString(),
      trigger,
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'GPT-5.5 completo una revision de investigacion; revisar hipotesis y reglas propuestas.',
      techniquesResearched: normalizeList(parsed.techniquesResearched, ['CFD cost awareness', 'Candle behavior validation', 'Session and spread filtering']),
      hypotheses: normalizeList(parsed.hypotheses, ['Validar entradas solo con vela cerrada y costo/target favorable.']),
      candleLessons: normalizeList(parsed.candleLessons, ['No operar rupturas sin cierre y confirmacion de vela.']),
      ruleProposals: normalizeRuleProposals(parsed.ruleProposals),
      riskWarnings: normalizeList(parsed.riskWarnings, ['Las recomendaciones son research only; requieren validacion paper.']),
      nextExperiment: typeof parsed.nextExperiment === 'string' ? parsed.nextExperiment : 'Probar una sola hipotesis paper con muestra controlada.',
    })
  } finally {
    clearTimeout(timeout)
  }
}

export function getCfdResearchLearningStatus() {
  if (!enabled) return buildBaseStatus({ status: 'DISABLED', summary: 'CFD research learning esta desactivado por configuracion.' })
  if (!apiKey()) return buildBaseStatus()
  return lastStatus
}

export async function runCfdResearchLearningNow(trigger = 'manual') {
  if (!enabled) {
    lastStatus = buildBaseStatus({ status: 'DISABLED', summary: 'CFD research learning esta desactivado por configuracion.' })
    return lastStatus
  }
  if (!apiKey()) {
    lastStatus = buildBaseStatus()
    return lastStatus
  }
  if (running) return running
  lastStatus = { ...lastStatus, configured: true, status: 'RUNNING', trigger, summary: 'GPT-5.5 esta investigando resultados, velas, costos y tecnicas CFD.' }
  running = requestOpenAiResearch(trigger)
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      lastStatus = buildBaseStatus({
        configured: true,
        status: 'ERROR',
        lastRunAt: new Date().toISOString(),
        nextRunAt: new Date(Date.now() + intervalMinutes * 60_000).toISOString(),
        trigger,
        summary: 'La investigacion GPT fallo; el agente sigue usando aprendizaje local y safety guards.',
        error: message,
        riskWarnings: ['No se aplico ningun cambio operativo por este error.'],
      })
      return lastStatus
    })
    .then((status) => {
      lastStatus = status
      return status
    })
    .finally(() => {
      running = null
    })
  return running
}

export function maybeRunCfdResearchLearning(trigger = 'scheduled') {
  if (!enabled || !apiKey() || running) return lastStatus
  if (!lastStatus.lastRunAt) {
    void runCfdResearchLearningNow(trigger)
    return lastStatus
  }
  const elapsed = Date.now() - new Date(lastStatus.lastRunAt).getTime()
  if (elapsed >= intervalMinutes * 60_000) void runCfdResearchLearningNow(trigger)
  return lastStatus
}
