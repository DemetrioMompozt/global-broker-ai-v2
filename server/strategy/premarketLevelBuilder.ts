import type { ProfessionalOpeningBar } from './trappedTraderDetector.js'
import { newYorkDay, newYorkMinutes } from './tradingTimezone.js'

export type TraderVideoLevel = {
  explanation: string
  levelName: string
  price: number
  reactionCount: number
  rejectionStrength: number
  strengthScore: number
  type:
    | 'PREVIOUS_DAY_HIGH'
    | 'PREVIOUS_DAY_LOW'
    | 'PREVIOUS_DAY_CLOSE'
    | 'OVERNIGHT_HIGH'
    | 'OVERNIGHT_LOW'
    | 'VWAP'
    | 'SIGNIFICANT_GAIN_MOVE'
    | 'SIGNIFICANT_LOSS_MOVE'
}

export type PremarketLevelBuilderStatus = {
  importantReactionZones: TraderVideoLevel[]
  overnightHigh: number | null
  overnightLow: number | null
  overnightRange: number | null
  previousDayClose: number | null
  previousDayHigh: number | null
  previousDayLow: number | null
  state: 'MARKING_PREMARKET_LEVELS' | 'BLOCKED_NO_LEVEL'
  vwap: number | null
}

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function high(bars: ProfessionalOpeningBar[]) {
  return bars.length ? Math.max(...bars.map((bar) => bar.high)) : null
}

function low(bars: ProfessionalOpeningBar[]) {
  return bars.length ? Math.min(...bars.map((bar) => bar.low)) : null
}

function countReactions(bars: ProfessionalOpeningBar[], price: number) {
  const tolerance = Math.max(price * 0.0004, 0.01)
  return bars.filter((bar) => bar.low - tolerance <= price && bar.high + tolerance >= price).length
}

function isRegularCashSession(bar: ProfessionalOpeningBar) {
  const minutes = newYorkMinutes(new Date(bar.timestamp))
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60
}

function isOvernightSessionIntoToday(bar: ProfessionalOpeningBar, previousDay: string | null, today: string) {
  const date = new Date(bar.timestamp)
  const day = newYorkDay(date)
  const minutes = newYorkMinutes(date)
  return (previousDay !== null && day === previousDay && minutes >= 16 * 60)
    || (day === today && minutes < 9 * 60 + 30)
}

function rejectionStrength(bars: ProfessionalOpeningBar[], price: number) {
  const tolerance = Math.max(price * 0.0004, 0.01)
  const touches = bars.filter((bar) => bar.low - tolerance <= price && bar.high + tolerance >= price)
  if (!touches.length) return 0
  const score = touches.reduce((sum, bar) => {
    const range = Math.max(bar.high - bar.low, Math.abs(bar.close) * 0.00001)
    const upper = bar.high - Math.max(bar.open, bar.close)
    const lower = Math.min(bar.open, bar.close) - bar.low
    return sum + Math.max(upper, lower) / range * 100
  }, 0) / touches.length
  return clamp(score)
}

function makeLevel(bars: ProfessionalOpeningBar[], levelName: string, type: TraderVideoLevel['type'], price: number | null): TraderVideoLevel | null {
  if (!finite(price)) return null
  const reactions = countReactions(bars, price)
  const rejection = rejectionStrength(bars, price)
  const strengthScore = clamp(45 + reactions * 8 + rejection * 0.25)
  return {
    explanation: `${levelName}: nivel marcado por ${type.toLowerCase().replaceAll('_', ' ')}; ${reactions} reacciones recientes.`,
    levelName,
    price,
    reactionCount: reactions,
    rejectionStrength: rejection,
    strengthScore,
    type,
  }
}

function floorToThirtyMinutesKey(date: Date) {
  const bucketMinute = Math.floor(newYorkMinutes(date) / 30) * 30
  return `${newYorkDay(date)}-${String(bucketMinute).padStart(4, '0')}`
}

function aggregateThirtyMinuteBars(bars: ProfessionalOpeningBar[]): ProfessionalOpeningBar[] {
  const buckets = new Map<string, ProfessionalOpeningBar[]>()
  const bucketOrder = new Map<string, number>()
  for (const bar of bars) {
    const key = floorToThirtyMinutesKey(new Date(bar.timestamp))
    if (!bucketOrder.has(key)) bucketOrder.set(key, Date.parse(bar.timestamp))
    buckets.set(key, [...(buckets.get(key) ?? []), bar])
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => (bucketOrder.get(left) ?? 0) - (bucketOrder.get(right) ?? 0))
    .map(([_key, bucket]) => {
      const sorted = bucket.sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
      const first = sorted[0]
      const last = sorted.at(-1)
      if (!first || !last) return null
      const aggregated: ProfessionalOpeningBar = {
        close: last.close,
        high: Math.max(...sorted.map((bar) => bar.high)),
        low: Math.min(...sorted.map((bar) => bar.low)),
        open: first.open,
        timestamp: first.timestamp,
        volume: sorted.reduce((sum, bar) => sum + Number(bar.volume ?? 0), 0),
      }
      return aggregated
    })
    .filter((bar): bar is ProfessionalOpeningBar => Boolean(bar))
}

function minLow(bars: ProfessionalOpeningBar[]) {
  return bars.length ? Math.min(...bars.map((bar) => bar.low)) : null
}

function maxHigh(bars: ProfessionalOpeningBar[]) {
  return bars.length ? Math.max(...bars.map((bar) => bar.high)) : null
}

function significantMoveLevels(bars: ProfessionalOpeningBar[]) {
  const thirtyMinuteBars = aggregateThirtyMinuteBars(bars)
  const lookbackBars = 3
  const lookaheadBars = 3
  const scored = thirtyMinuteBars.flatMap((bar, index) => {
    const before = thirtyMinuteBars.slice(Math.max(0, index - lookbackBars), index)
    const after = thirtyMinuteBars.slice(index + 1, index + 1 + lookaheadBars)
    const previousHigh = maxHigh(before)
    const previousLow = minLow(before)
    const futureHigh = maxHigh(after)
    const futureLow = minLow(after)
    const range = Math.max(bar.high - bar.low, Math.abs(bar.close) * 0.00001)
    const candidates: Array<{ bar: ProfessionalOpeningBar; direction: 'GAIN' | 'LOSS'; pivotPrice: number; score: number }> = []

    const reboundHigh = finite(futureHigh) ? Math.max(bar.high, futureHigh) : bar.high
    const selloffLow = finite(futureLow) ? Math.min(bar.low, futureLow) : bar.low

    if (finite(previousHigh)) {
      const priorDrop = previousHigh - bar.low
      const rebound = reboundHigh - bar.low
      if (priorDrop > 0 && rebound > 0) {
        candidates.push({
          bar,
          direction: 'GAIN',
          pivotPrice: bar.low,
          score: Math.min(priorDrop, rebound) * 0.7 + Math.max(priorDrop, rebound) * 0.2 + range * 0.1,
        })
      }
    }

    if (finite(previousLow)) {
      const priorRise = bar.high - previousLow
      const selloff = bar.high - selloffLow
      if (priorRise > 0 && selloff > 0) {
        candidates.push({
          bar,
          direction: 'LOSS',
          pivotPrice: bar.high,
          score: Math.min(priorRise, selloff) * 0.7 + Math.max(priorRise, selloff) * 0.2 + range * 0.1,
        })
      }
    }

    return candidates
  }).filter((item) => item.score > 0)
  const strongestGain = scored.filter((item) => item.direction === 'GAIN').sort((left, right) => right.score - left.score)[0]
  const strongestLoss = scored.filter((item) => item.direction === 'LOSS').sort((left, right) => right.score - left.score)[0]
  return [strongestGain, strongestLoss].filter((item): item is NonNullable<typeof item> => Boolean(item)).map((item) => {
    const price = item.pivotPrice
    const level = makeLevel(
      bars,
      item.direction === 'GAIN' ? 'M30 previous-day bullish reversal pivot' : 'M30 previous-day bearish reversal pivot',
      item.direction === 'GAIN' ? 'SIGNIFICANT_GAIN_MOVE' : 'SIGNIFICANT_LOSS_MOVE',
      price,
    )
    return level
      ? {
        ...level,
        explanation: item.direction === 'GAIN'
          ? `${level.levelName}: pico bajo del dia anterior donde venia cayendo fuerte y reboto con fuerza en M30.`
          : `${level.levelName}: pico alto del dia anterior donde venia subiendo fuerte y vendieron con fuerza en M30.`,
        strengthScore: clamp(level.strengthScore + Math.min(20, item.score)),
      }
      : null
  }).filter((level): level is TraderVideoLevel => Boolean(level))
}

export function buildPremarketLevels(input: {
  bars: ProfessionalOpeningBar[]
  now?: Date
}): PremarketLevelBuilderStatus {
  const now = input.now ?? new Date()
  const bars = input.bars.filter((bar) => [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite))
  const today = newYorkDay(now)
  const previousDays = [...new Set(bars.map((bar) => newYorkDay(new Date(bar.timestamp))).filter((day) => day < today))].sort()
  const previousDay = previousDays.at(-1) ?? null
  const previousBars = previousDay ? bars.filter((bar) => newYorkDay(new Date(bar.timestamp)) === previousDay) : []
  const previousRegularSessionBars = previousBars.filter(isRegularCashSession)
  const todayBars = bars.filter((bar) => newYorkDay(new Date(bar.timestamp)) === today)
  const overnightBars = bars.filter((bar) => isOvernightSessionIntoToday(bar, previousDay, today))
  const previousDayHigh = high(previousRegularSessionBars)
  const previousDayLow = low(previousRegularSessionBars)
  const previousDayClose = previousRegularSessionBars.at(-1)?.close ?? null
  const overnightHigh = high(overnightBars)
  const overnightLow = low(overnightBars)
  const vwapSource = todayBars.length ? todayBars : bars
  const volumeSum = vwapSource.reduce((sum, bar) => sum + Number(bar.volume ?? 1), 0)
  const vwap = volumeSum > 0
    ? vwapSource.reduce((sum, bar) => sum + ((bar.high + bar.low + bar.close) / 3) * Number(bar.volume ?? 1), 0) / volumeSum
    : null
  const levels = [
    makeLevel(bars, 'Cash 09:30-16:00 high', 'PREVIOUS_DAY_HIGH', previousDayHigh),
    makeLevel(bars, 'Cash 09:30-16:00 low', 'PREVIOUS_DAY_LOW', previousDayLow),
    makeLevel(bars, 'Previous cash close', 'PREVIOUS_DAY_CLOSE', previousDayClose),
    makeLevel(bars, 'Overnight 16:00-09:30 high', 'OVERNIGHT_HIGH', overnightHigh),
    makeLevel(bars, 'Overnight 16:00-09:30 low', 'OVERNIGHT_LOW', overnightLow),
    makeLevel(bars, 'VWAP', 'VWAP', vwap),
  ].filter((level): level is TraderVideoLevel => Boolean(level))

  return {
    importantReactionZones: levels.sort((left, right) => right.strengthScore - left.strengthScore),
    overnightHigh,
    overnightLow,
    overnightRange: finite(overnightHigh) && finite(overnightLow) ? overnightHigh - overnightLow : null,
    previousDayClose,
    previousDayHigh,
    previousDayLow,
    state: levels.length >= 3 ? 'MARKING_PREMARKET_LEVELS' : 'BLOCKED_NO_LEVEL',
    vwap,
  }
}
