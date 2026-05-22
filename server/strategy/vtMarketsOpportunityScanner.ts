import { getCfdQuote } from '../cfd/cfdPricingEngine.js'
import { getStatus as getVtStatus } from '../broker/vtMarketsConnector.js'
import { routeStrategy } from './opportunityStrategyRouter.js'
import { evaluateCandleBehavior, recordCfdCandleTick } from './candleBehaviorEngine.js'
import { observeVtEdge } from './vtMarketsEdgeModel.js'
import { buildLossAttribution } from '../performance/lossAttributionEngine.js'
import type { Opportunity } from './globalOpportunityScanner.js'
import type { AssetClass } from '../symbols/cfdInstrumentRegistry.js'

const vtSymbols = ['EURUSD.cfd', 'GBPUSD.cfd', 'USDJPY.cfd', 'USDCHF.cfd', 'NAS100.cfd', 'US500.cfd', 'XAUUSD.cfd']

function assetClassFor(symbol: string): AssetClass {
  if (symbol.includes('NAS') || symbol.includes('US500')) return 'INDEX_CFD'
  if (symbol.includes('XAU')) return 'METAL_CFD'
  return 'FOREX_CFD'
}

function scoreFromSpread(spreadBps: number, assetClass: string) {
  const baseline = assetClass === 'FOREX_CFD' ? 90 : assetClass === 'INDEX_CFD' ? 88 : 86
  return Math.max(60, Math.min(94, baseline - Math.max(0, spreadBps - 8) * 0.8))
}

export async function scanVtMarketsOpportunities() {
  const status = await getVtStatus()
  const opportunities: Opportunity[] = []
  const blocked: Array<{ cfdSymbol: string; reason: string }> = []

  if (status.status !== 'CONNECTED_DEMO_READ_ONLY') {
    return {
      blocked: vtSymbols.map((cfdSymbol) => ({ cfdSymbol, reason: 'DISABLED_NOT_CONNECTED: VT Markets demo read-only no esta conectado.' })),
      opportunities,
    }
  }

  const lossMemory = buildLossAttribution()
  for (const cfdSymbol of vtSymbols) {
    const quote = await getCfdQuote(cfdSymbol)
    const assetClass = assetClassFor(cfdSymbol)
    if (quote.feedType !== 'BROKER_DEMO_REALTIME' || quote.pricingQuality !== 'LIVE_BID_ASK') {
      blocked.push({ cfdSymbol, reason: 'Feed VT no disponible o sin bid/ask vivo.' })
      continue
    }
    recordCfdCandleTick(cfdSymbol, quote.mid)
    const spreadScore = scoreFromSpread(quote.spreadBps, assetClass)
    const edge = observeVtEdge(cfdSymbol, quote, assetClass)
    const candle = evaluateCandleBehavior(cfdSymbol, 'VT_MARKETS_MT5_DEMO', edge.direction)
    const symbolMemory = lossMemory.symbolDiagnostics.find((item) => item.symbol === cfdSymbol)
    const exceptionalEdge = edge.confirmed
      && Math.abs(edge.moveBps) / Math.max(edge.requiredMoveBps, 0.0001) >= 2.5
      && edge.persistence >= 0.78
      && edge.efficiency >= 0.65
    if (symbolMemory?.status === 'BAN_FOR_SESSION') {
      blocked.push({ cfdSymbol, reason: `SESSION_BAN: ${cfdSymbol} viene perdiendo hoy (net $${symbolMemory.netPnl.toFixed(2)}, PF ${symbolMemory.profitFactor ?? 0}).` })
      continue
    }
    if (symbolMemory?.status === 'SUSPEND' && !exceptionalEdge) {
      blocked.push({ cfdSymbol, reason: `SYMBOL_SUSPENDED: memoria trader bloquea reentrada; ${cfdSymbol} net $${symbolMemory.netPnl.toFixed(2)} hoy.` })
      continue
    }
    const candlePenalty = candle.signal === 'BLOCKS_ENTRY' ? 18 : 0
    const candleBoost = candle.signal === 'CONFIRMS_ENTRY' ? 7 : 0
    const score = edge.confirmed ? Math.min(96, (spreadScore * 0.35) + (edge.score * 0.65) + candleBoost - candlePenalty) : Math.min(84, edge.score + candleBoost - candlePenalty)
    const confirmed = edge.confirmed && score >= 85 && candle.signal !== 'BLOCKS_ENTRY'
    opportunities.push({
      assetClass,
      cfdExpertScore: confirmed ? Math.max(82, Math.round(score - 2)) : Math.max(65, Math.round(score - 8)),
      cfdSymbol,
      decision: confirmed ? 'APPROVED' : 'WATCH',
      direction: edge.direction,
      edgeEfficiency: edge.efficiency,
      edgeMoveBps: edge.moveBps,
      edgePersistence: edge.persistence,
      edgeRequiredMoveBps: edge.requiredMoveBps,
      expectedNetProfit: Number((2 + score / 50).toFixed(2)),
      candleBehavior: candle,
      candleBehaviorScore: candle.score,
      candlePattern: candle.pattern,
      opportunityScore: score,
      reason: confirmed
        ? `${edge.reason} ${candle.reason} VT Markets demo feed OK, spread ${quote.spreadBps.toFixed(2)} bps y margen paper sano.`
        : `${edge.reason} ${candle.reason} WATCH: falta edge/vela real aunque el spread sea ${quote.spreadBps.toFixed(2)} bps.`,
      riskReward: 2.1,
      setupConfirmed: confirmed,
      setupStatus: confirmed ? 'CONFIRMED' : edge.setupStatus,
      source: 'VT_MARKETS_MT5_DEMO',
      strategy: routeStrategy(assetClass, score),
      timeframe: assetClass === 'FOREX_CFD' ? 'INTRADAY_SLOW' : 'SHORT_SWING',
      underlyingSymbol: quote.underlyingSymbol,
      quote,
    })
  }
  return { blocked, opportunities }
}
