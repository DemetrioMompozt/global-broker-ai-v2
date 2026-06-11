import type { ProfessionalOpeningBar } from './trappedTraderDetector.js'

export type MovementNatureResult = {
  continuationStrength: number
  dominantPressure: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  explanation: string
  impulseStrength: number
  impulseVelocity: number
  institutionalPressureScore: number
  moveAsymmetryScore: number
  pullbackVelocity: number
  pullbackWeakness: number
  recoveryFailure: number
  volumeConfirmation: number
  wickRejection: number
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function minutesBetween(first: ProfessionalOpeningBar, last: ProfessionalOpeningBar) {
  const start = Date.parse(first.timestamp)
  const end = Date.parse(last.timestamp)
  const diff = Number.isFinite(start) && Number.isFinite(end) ? Math.abs(end - start) / 60_000 : 1
  return Math.max(1, diff)
}

function priceVelocity(bars: ProfessionalOpeningBar[]) {
  const first = bars[0]
  const last = bars.at(-1)
  if (!first || !last || !Number.isFinite(first.close) || !Number.isFinite(last.close)) return 0
  return Math.abs(last.close - first.close) / minutesBetween(first, last)
}

function signedMove(bars: ProfessionalOpeningBar[]) {
  const first = bars[0]
  const last = bars.at(-1)
  if (!first || !last) return 0
  return last.close - first.close
}

function avgBodyRatio(bars: ProfessionalOpeningBar[]) {
  if (!bars.length) return 0
  const ratios = bars.map((bar) => {
    const range = Math.max(bar.high - bar.low, Math.abs(bar.close) * 0.00001)
    return Math.abs(bar.close - bar.open) / range
  })
  return ratios.reduce((sum, item) => sum + item, 0) / ratios.length
}

function wickRejectionScore(bars: ProfessionalOpeningBar[], pressure: 'BULLISH' | 'BEARISH') {
  if (!bars.length) return 0
  const latest = bars.at(-1)!
  const range = Math.max(latest.high - latest.low, Math.abs(latest.close) * 0.00001)
  const upperWick = latest.high - Math.max(latest.open, latest.close)
  const lowerWick = Math.min(latest.open, latest.close) - latest.low
  return clamp(((pressure === 'BEARISH' ? upperWick : lowerWick) / range) * 100)
}

function volumeScore(impulseBars: ProfessionalOpeningBar[], pullbackBars: ProfessionalOpeningBar[]) {
  const impulseVolumes = impulseBars.map((bar) => Number(bar.volume ?? 0)).filter(Number.isFinite)
  const pullbackVolumes = pullbackBars.map((bar) => Number(bar.volume ?? 0)).filter(Number.isFinite)
  if (!impulseVolumes.length || !pullbackVolumes.length) return 50
  const impulseAvg = impulseVolumes.reduce((sum, item) => sum + item, 0) / impulseVolumes.length
  const pullbackAvg = pullbackVolumes.reduce((sum, item) => sum + item, 0) / pullbackVolumes.length
  return clamp((impulseAvg / Math.max(pullbackAvg, 1)) * 45)
}

export function analyzeMovementNature(input: {
  bars?: ProfessionalOpeningBar[]
  impulseBars?: ProfessionalOpeningBar[]
  intendedDirection?: 'LONG' | 'SHORT'
  pullbackBars?: ProfessionalOpeningBar[]
}): MovementNatureResult {
  const bars = (input.bars ?? [...(input.impulseBars ?? []), ...(input.pullbackBars ?? [])])
    .filter((bar) => [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite))
  if (bars.length < 3) {
    return {
      continuationStrength: 0,
      dominantPressure: 'NEUTRAL',
      explanation: 'No hay suficientes velas para comparar impulso institucional contra pullback debil.',
      impulseStrength: 0,
      impulseVelocity: 0,
      institutionalPressureScore: 0,
      moveAsymmetryScore: 0,
      pullbackVelocity: 0,
      pullbackWeakness: 0,
      recoveryFailure: 0,
      volumeConfirmation: 0,
      wickRejection: 0,
    }
  }

  const midpoint = Math.max(1, Math.floor(bars.length * 0.55))
  const impulseBars = input.impulseBars?.length ? input.impulseBars : bars.slice(0, midpoint)
  const pullbackBars = input.pullbackBars?.length ? input.pullbackBars : bars.slice(midpoint)
  const impulseMove = signedMove(impulseBars)
  const fullMove = signedMove(bars)
  const pressure = input.intendedDirection === 'LONG'
    ? 'BULLISH'
    : input.intendedDirection === 'SHORT'
      ? 'BEARISH'
      : fullMove > 0
        ? 'BULLISH'
        : fullMove < 0
          ? 'BEARISH'
          : 'NEUTRAL'
  const impulseVelocity = priceVelocity(impulseBars)
  const pullbackVelocity = priceVelocity(pullbackBars)
  const impulseRange = Math.abs(impulseMove)
  const pullbackMove = Math.abs(signedMove(pullbackBars))
  const asymmetry = impulseVelocity / Math.max(pullbackVelocity, 0.0000001)
  const moveAsymmetryScore = clamp(asymmetry * 28)
  const pullbackWeakness = clamp((1 - Math.min(1, pullbackMove / Math.max(impulseRange, 0.0000001))) * 100)
  const impulseStrength = clamp(avgBodyRatio(impulseBars) * 55 + moveAsymmetryScore * 0.45)
  const continuationStrength = clamp((Math.abs(fullMove) / Math.max(impulseRange, 0.0000001)) * 70)
  const recoveryFailure = clamp(pullbackWeakness * 0.7 + (pullbackVelocity < impulseVelocity ? 25 : 0))
  const wickRejection = wickRejectionScore(pullbackBars.length ? pullbackBars : bars, pressure === 'NEUTRAL' ? 'BULLISH' : pressure)
  const volumeConfirmation = volumeScore(impulseBars, pullbackBars)
  const institutionalPressureScore = clamp(
    impulseStrength * 0.28
    + pullbackWeakness * 0.24
    + moveAsymmetryScore * 0.20
    + recoveryFailure * 0.14
    + wickRejection * 0.07
    + volumeConfirmation * 0.07,
  )

  const label = pressure === 'BEARISH'
    ? 'venta dominante'
    : pressure === 'BULLISH'
      ? 'compra dominante'
      : 'presion neutral'

  return {
    continuationStrength,
    dominantPressure: institutionalPressureScore >= 55 ? pressure : 'NEUTRAL',
    explanation: `${label}: impulso ${impulseVelocity.toFixed(4)} por minuto vs pullback ${pullbackVelocity.toFixed(4)}; asimetria ${asymmetry.toFixed(2)}x.`,
    impulseStrength,
    impulseVelocity,
    institutionalPressureScore,
    moveAsymmetryScore,
    pullbackVelocity,
    pullbackWeakness,
    recoveryFailure,
    volumeConfirmation,
    wickRejection,
  }
}
