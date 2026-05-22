import type { CfdQuote } from '../cfd/cfdPricingEngine.js'
import type { AssetClass } from '../symbols/cfdInstrumentRegistry.js'

type EdgeTick = {
  mid: number
  spreadBps: number
  timestamp: number
}

export type VtEdgeReadout = {
  confirmed: boolean
  direction: 'LONG' | 'SHORT'
  efficiency: number
  moveBps: number
  persistence: number
  reason: string
  requiredMoveBps: number
  samples: number
  score: number
  setupStatus: 'BUILDING_EDGE_MEMORY' | 'EDGE_CONFIRMED' | 'NO_DIRECTIONAL_EDGE' | 'NOISY_PRICE_ACTION'
}

const historyBySymbol = new Map<string, EdgeTick[]>()

const maxSamples = 24
const minSamples = 4

function baseRequiredMoveBps(assetClass: AssetClass) {
  if (assetClass === 'FOREX_CFD') return 0.35
  if (assetClass === 'INDEX_CFD') return 0.8
  if (assetClass === 'METAL_CFD') return 0.9
  return 1.2
}

function decimals(assetClass: AssetClass) {
  return assetClass === 'FOREX_CFD' ? 2 : 1
}

export function resetVtEdgeMemory() {
  historyBySymbol.clear()
}

export function observeVtEdge(cfdSymbol: string, quote: CfdQuote, assetClass: AssetClass): VtEdgeReadout {
  const previous = historyBySymbol.get(cfdSymbol) ?? []
  const next = [...previous, { mid: quote.mid, spreadBps: quote.spreadBps, timestamp: Date.now() }]
    .filter((tick) => Number.isFinite(tick.mid) && tick.mid > 0)
    .slice(-maxSamples)
  historyBySymbol.set(cfdSymbol, next)

  const requiredMoveBps = Math.max(baseRequiredMoveBps(assetClass), quote.spreadBps * 1.5)
  if (next.length < minSamples) {
    return {
      confirmed: false,
      direction: quote.sourcePrice.change < 0 ? 'SHORT' : 'LONG',
      efficiency: 0,
      moveBps: 0,
      persistence: 0,
      reason: `Construyendo memoria de edge (${next.length}/${minSamples} ticks). No abrir solo por spread barato.`,
      requiredMoveBps,
      samples: next.length,
      score: 70,
      setupStatus: 'BUILDING_EDGE_MEMORY',
    }
  }

  const first = next[0]
  const last = next[next.length - 1]
  const moveBps = first.mid > 0 ? (last.mid - first.mid) / first.mid * 10_000 : 0
  const direction: 'LONG' | 'SHORT' = moveBps >= 0 ? 'LONG' : 'SHORT'
  const steps = next.slice(1).map((tick, index) => tick.mid - next[index].mid)
  const directionalSteps = steps.filter((step) => direction === 'LONG' ? step > 0 : step < 0).length
  const activeSteps = steps.filter((step) => step !== 0).length
  const persistence = activeSteps > 0 ? directionalSteps / activeSteps : 0
  const pathBps = steps.reduce((sum, step, index) => {
    const base = next[index].mid
    return sum + (base > 0 ? Math.abs(step) / base * 10_000 : 0)
  }, 0)
  const efficiency = pathBps > 0 ? Math.min(1, Math.abs(moveBps) / pathBps) : 0
  const moveOk = Math.abs(moveBps) >= requiredMoveBps
  const persistenceOk = persistence >= 0.42
  const efficiencyOk = efficiency >= 0.15
  const confirmed = moveOk && persistenceOk && efficiencyOk
  const score = Math.max(62, Math.min(96,
    70
    + Math.min(12, Math.abs(moveBps) / requiredMoveBps * 6)
    + persistence * 8
    + efficiency * 8
    - Math.max(0, quote.spreadBps - 2) * 0.5
  ))

  let setupStatus: VtEdgeReadout['setupStatus'] = 'EDGE_CONFIRMED'
  let reason = `${direction} confirmado: movimiento ${moveBps.toFixed(decimals(assetClass))} bps, persistencia ${(persistence * 100).toFixed(0)}%, eficiencia ${(efficiency * 100).toFixed(0)}%.`
  if (!moveOk) {
    setupStatus = 'NO_DIRECTIONAL_EDGE'
    reason = `Sin edge direccional: movimiento ${moveBps.toFixed(decimals(assetClass))} bps < requerido ${requiredMoveBps.toFixed(decimals(assetClass))} bps.`
  } else if (!persistenceOk || !efficiencyOk) {
    setupStatus = 'NOISY_PRICE_ACTION'
    reason = `Movimiento ruidoso: persistencia ${(persistence * 100).toFixed(0)}%, eficiencia ${(efficiency * 100).toFixed(0)}%. Esperando mejor estructura.`
  }

  return {
    confirmed,
    direction,
    efficiency: Number(efficiency.toFixed(4)),
    moveBps: Number(moveBps.toFixed(4)),
    persistence: Number(persistence.toFixed(4)),
    reason,
    requiredMoveBps: Number(requiredMoveBps.toFixed(4)),
    samples: next.length,
    score: Number(score.toFixed(2)),
    setupStatus,
  }
}
