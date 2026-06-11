import type { TraderVideoSetupObservation } from './traderVideoSetupJournal.js'
import { newYorkDay, newYorkMinutes } from './tradingTimezone.js'
import type { ProfessionalOpeningBar } from './trappedTraderDetector.js'

export type TraderVideoExperienceOutcome =
  | 'HYPOTHETICAL_TARGET_HIT'
  | 'HYPOTHETICAL_STOP_HIT'
  | 'HYPOTHETICAL_TIME_EXPIRED'
  | 'NO_VALID_ENTRY'

export type TraderVideoExperienceCandidate = {
  blockers: string[]
  direction: 'LONG' | 'SHORT'
  entryPrice: number
  entryTime: string
  evidence: string[]
  exitPrice: number | null
  exitTime: string | null
  lesson: string
  outcome: TraderVideoExperienceOutcome
  riskRewardRatio: number
  sessionDate: string
  setupState: string
  stopPrice: number
  targetPrice: number
}

export type TraderVideoExperienceAgentStatus = {
  advisoryOnly: true
  barsAnalyzed: number
  experienceQuality: 'INSUFFICIENT_DATA' | 'OBSERVING' | 'EXPERIENCE_READY'
  legalCorpusStatus: 'LEGAL_SUMMARIES_ONLY'
  lessons: string[]
  lookbackDaysRequested: number
  mode: 'TRADER_VIDEO_MARKET_EXPERIENCE_AGENT'
  possibleEntriesReviewed: number
  recentDaysAnalyzed: number
  recommendedFocus: string
  replayCandidates: TraderVideoExperienceCandidate[]
  topHistoricalBlockers: Array<{ count: number; reason: string }>
  timestamp: string
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function sortedBars(bars: ProfessionalOpeningBar[]) {
  return bars
    .filter((bar) => [bar.open, bar.high, bar.low, bar.close].every(finite))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
}

function groupDays(bars: ProfessionalOpeningBar[]) {
  const grouped = new Map<string, ProfessionalOpeningBar[]>()
  for (const bar of sortedBars(bars)) {
    const day = newYorkDay(new Date(bar.timestamp))
    grouped.set(day, [...(grouped.get(day) ?? []), bar])
  }
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))
}

function isStrategicMinute(bar: ProfessionalOpeningBar) {
  const minutes = newYorkMinutes(new Date(bar.timestamp))
  return minutes >= 9 * 60 + 45 && minutes < 16 * 60
}

function simulateExit(input: {
  afterEntry: ProfessionalOpeningBar[]
  direction: 'LONG' | 'SHORT'
  stopPrice: number
  targetPrice: number
}) {
  for (const bar of input.afterEntry) {
    if (input.direction === 'SHORT') {
      if (bar.high >= input.stopPrice) {
        return {
          exitPrice: input.stopPrice,
          exitTime: bar.timestamp,
          outcome: 'HYPOTHETICAL_STOP_HIT' as const,
        }
      }
      if (bar.low <= input.targetPrice) {
        return {
          exitPrice: input.targetPrice,
          exitTime: bar.timestamp,
          outcome: 'HYPOTHETICAL_TARGET_HIT' as const,
        }
      }
    } else {
      if (bar.low <= input.stopPrice) {
        return {
          exitPrice: input.stopPrice,
          exitTime: bar.timestamp,
          outcome: 'HYPOTHETICAL_STOP_HIT' as const,
        }
      }
      if (bar.high >= input.targetPrice) {
        return {
          exitPrice: input.targetPrice,
          exitTime: bar.timestamp,
          outcome: 'HYPOTHETICAL_TARGET_HIT' as const,
        }
      }
    }
  }
  const last = input.afterEntry.at(-1)
  return {
    exitPrice: last?.close ?? null,
    exitTime: last?.timestamp ?? null,
    outcome: last ? 'HYPOTHETICAL_TIME_EXPIRED' as const : 'NO_VALID_ENTRY' as const,
  }
}

function openingRangeForDay(dayBars: ProfessionalOpeningBar[]) {
  const openingBars = dayBars.filter((bar) => {
    const minutes = newYorkMinutes(new Date(bar.timestamp))
    return minutes >= 9 * 60 + 30 && minutes < 9 * 60 + 45
  })
  if (openingBars.length < 10) return null
  return {
    high: Math.max(...openingBars.map((bar) => bar.high)),
    low: Math.min(...openingBars.map((bar) => bar.low)),
  }
}

function buildHeuristicCandidate(input: {
  dayBars: ProfessionalOpeningBar[]
  direction: 'LONG' | 'SHORT'
  openingRange: { high: number; low: number }
  sessionDate: string
  triggerBar: ProfessionalOpeningBar
}) {
  const direction = input.direction
  const entryPrice = input.triggerBar.close
  const setupStart = Math.max(0, input.dayBars.findIndex((bar) => bar.timestamp === input.triggerBar.timestamp) - 6)
  const setupBars = input.dayBars.slice(setupStart, input.dayBars.findIndex((bar) => bar.timestamp === input.triggerBar.timestamp) + 1)
  const riskBuffer = Math.max(entryPrice * 0.00005, 0.25)
  const stopPrice = direction === 'SHORT'
    ? Math.max(...setupBars.map((bar) => bar.high)) + riskBuffer
    : Math.min(...setupBars.map((bar) => bar.low)) - riskBuffer
  const risk = Math.abs(entryPrice - stopPrice)
  if (!Number.isFinite(risk) || risk <= 0) return null
  const targetPrice = direction === 'SHORT'
    ? entryPrice - risk * 2
    : entryPrice + risk * 2
  const afterEntry = input.dayBars.filter((bar) => Date.parse(bar.timestamp) > Date.parse(input.triggerBar.timestamp) && isStrategicMinute(bar))
  const exit = simulateExit({
    afterEntry,
    direction,
    stopPrice,
    targetPrice,
  })
  const blockers: string[] = []
  const lesson = exit.outcome === 'HYPOTHETICAL_TARGET_HIT'
    ? 'Caso util: la historia completa habria alcanzado objetivo 1:2 en replay; guardar como ejemplo positivo.'
    : exit.outcome === 'HYPOTHETICAL_STOP_HIT'
      ? 'Caso de riesgo: aun con historia aceptable, el stop habria sido tocado; revisar ubicacion de stop y calidad del retest.'
      : 'Caso incompleto: la entrada hipotetica no resolvio rapido; revisar si era rotacion valida o rango sin decision.'
  return {
    blockers,
    direction,
    entryPrice: round(entryPrice, 2),
    entryTime: input.triggerBar.timestamp,
    evidence: [
      direction === 'SHORT'
        ? `Estudio retrospectivo: ruptura/fallo sobre ORH ${round(input.openingRange.high, 2)}; compradores potencialmente atrapados.`
        : `Estudio retrospectivo: ruptura/fallo bajo ORL ${round(input.openingRange.low, 2)}; vendedores potencialmente atrapados.`,
      'Caso para que el agente compare contra la regla viva: trendline 3P, ruptura cerrada, retest fallido y vela japonesa.',
      'No autoriza entrada por si solo; solo crea experiencia de mercado.',
    ],
    exitPrice: finite(exit.exitPrice) ? round(exit.exitPrice, 2) : null,
    exitTime: exit.exitTime,
    lesson,
    outcome: exit.outcome,
    riskRewardRatio: 2,
    sessionDate: input.sessionDate,
    setupState: direction === 'SHORT' ? 'BULL_TRAP_REPLAY_CANDIDATE' : 'BEAR_TRAP_REPLAY_CANDIDATE',
    stopPrice: round(stopPrice, 2),
    targetPrice: round(targetPrice, 2),
  } satisfies TraderVideoExperienceCandidate
}

function scanReplayCandidates(input: {
  bars: ProfessionalOpeningBar[]
  lookbackDays: number
  officialBrokerSymbol?: string | null
  officialSymbol?: string | null
}) {
  const sorted = sortedBars(input.bars)
  const days = groupDays(sorted).slice(-input.lookbackDays)
  const candidates: TraderVideoExperienceCandidate[] = []
  let possibleEntriesReviewed = 0
  for (const [sessionDate, dayBars] of days) {
    const openingRange = openingRangeForDay(dayBars)
    if (!openingRange) continue
    const sessionBars = dayBars.filter(isStrategicMinute)
    for (let index = 0; index < sessionBars.length; index += 1) {
      const bar = sessionBars[index]
      if (!bar) continue
      possibleEntriesReviewed += 1
      const tolerance = Math.max(bar.close * 0.00005, 0.25)
      const bullTrap = bar.high > openingRange.high + tolerance && bar.close < openingRange.high
      const bearTrap = bar.low < openingRange.low - tolerance && bar.close > openingRange.low
      const candidate = bullTrap
        ? buildHeuristicCandidate({
          dayBars,
          direction: 'SHORT',
          openingRange,
          sessionDate,
          triggerBar: bar,
        })
        : bearTrap
          ? buildHeuristicCandidate({
            dayBars,
            direction: 'LONG',
            openingRange,
            sessionDate,
            triggerBar: bar,
          })
          : null
      if (!candidate) continue
      candidates.push(candidate)
      if (candidates.filter((item) => item.sessionDate === sessionDate).length >= 3) break
    }
  }
  return {
    candidates: candidates.slice(-12).reverse(),
    daysAnalyzed: days.length,
    possibleEntriesReviewed,
  }
}

function topBlockers(observations: TraderVideoSetupObservation[]) {
  const counts = new Map<string, number>()
  for (const observation of observations) {
    for (const reason of observation.blockedReasons ?? []) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ count, reason }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5)
}

function buildLessons(input: {
  candidates: TraderVideoExperienceCandidate[]
  observations: TraderVideoSetupObservation[]
}) {
  const lessons: string[] = []
  const targets = input.candidates.filter((candidate) => candidate.outcome === 'HYPOTHETICAL_TARGET_HIT').length
  const stops = input.candidates.filter((candidate) => candidate.outcome === 'HYPOTHETICAL_STOP_HIT').length
  if (input.candidates.length === 0) {
    lessons.push('No se encontraron entradas retrospectivas completas con las reglas actuales; el agente debe seguir acumulando casos reales.')
  } else {
    lessons.push(`Replay supervisado encontro ${input.candidates.length} casos completos: ${targets} objetivos, ${stops} stops y ${input.candidates.length - targets - stops} expirados.`)
  }
  const mostCommon = topBlockers(input.observations)[0]
  if (mostCommon) lessons.push(`Bloqueo historico dominante: ${mostCommon.reason} (${mostCommon.count}).`)
  if (input.candidates.some((candidate) => candidate.outcome === 'HYPOTHETICAL_STOP_HIT')) {
    lessons.push('Los stops retrospectivos se usan para estudiar calidad de retest y ubicacion de stop, no para relajar el metodo.')
  }
  lessons.push('Todo aprendizaje es advisory-only: no abre operaciones ni reemplaza DataGuard/RiskGuard/V4.')
  return lessons
}

export function buildTraderVideoExperienceAgent(input: {
  bars?: ProfessionalOpeningBar[]
  lookbackDays?: number
  now?: Date
  observations?: TraderVideoSetupObservation[]
  officialBrokerSymbol?: string | null
  officialSymbol?: string | null
}): TraderVideoExperienceAgentStatus {
  const now = input.now ?? new Date()
  const lookbackDaysRequested = Math.max(3, Math.min(15, Math.floor(input.lookbackDays ?? 10)))
  const bars = sortedBars(input.bars ?? [])
  const replay = scanReplayCandidates({
    bars,
    lookbackDays: lookbackDaysRequested,
    officialBrokerSymbol: input.officialBrokerSymbol,
    officialSymbol: input.officialSymbol,
  })
  const observations = input.observations ?? []
  const replayTargets = replay.candidates.filter((candidate) => candidate.outcome === 'HYPOTHETICAL_TARGET_HIT').length
  const experienceQuality: TraderVideoExperienceAgentStatus['experienceQuality'] = bars.length >= 2500 && replay.candidates.length >= 5
    ? 'EXPERIENCE_READY'
    : bars.length >= 600 || observations.length >= 50
      ? 'OBSERVING'
      : 'INSUFFICIENT_DATA'
  const recommendedFocus = experienceQuality === 'INSUFFICIENT_DATA'
    ? 'Cargar mas velas historicas M1/M30 de S&P futures y seguir guardando observaciones.'
    : replay.candidates.length === 0
      ? 'Seguir buscando historia completa: marca, atrapados, trendline 3P, ruptura, retest y R/R 1:2.'
      : replayTargets >= Math.max(1, replay.candidates.length * 0.45)
        ? 'Usar los casos positivos como plantilla supervisada; no escalar ni abrir real.'
        : 'Auditar stops/expiraciones para endurecer lectura de retest y calidad de vela.'
  return {
    advisoryOnly: true,
    barsAnalyzed: bars.length,
    experienceQuality,
    legalCorpusStatus: 'LEGAL_SUMMARIES_ONLY',
    lessons: buildLessons({
      candidates: replay.candidates,
      observations,
    }),
    lookbackDaysRequested,
    mode: 'TRADER_VIDEO_MARKET_EXPERIENCE_AGENT',
    possibleEntriesReviewed: replay.possibleEntriesReviewed,
    recentDaysAnalyzed: replay.daysAnalyzed,
    recommendedFocus,
    replayCandidates: replay.candidates,
    timestamp: now.toISOString(),
    topHistoricalBlockers: topBlockers(observations),
  }
}
