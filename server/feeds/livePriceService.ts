import { resolveSymbol } from '../symbols/symbolMappingService.js'
import { getBinanceLivePrice, getBinanceStatus } from './binanceLivePriceProvider.js'
import type { LivePrice } from './feedTypes.js'

const previous = new Map<string, number>()

function previousParts(asset: string, price: number, explicitPrevious?: number) {
  const previousPrice = explicitPrevious ?? previous.get(asset) ?? price
  previous.set(asset, price)
  return {
    previousPrice,
    change: Number((price - previousPrice).toFixed(8)),
    changePercent: previousPrice > 0 ? Number(((price / previousPrice - 1) * 100).toFixed(6)) : 0,
  }
}

async function binanceRest(symbol: string) {
  for (const provider of [
    { name: 'Binance REST', url: 'https://api.binance.com/api/v3/ticker/price' },
    { name: 'Binance.US REST', url: 'https://api.binance.us/api/v3/ticker/price' },
  ]) {
    try {
      const response = await fetch(`${provider.url}?symbol=${encodeURIComponent(symbol)}`)
      if (!response.ok) continue
      const payload = await response.json() as { price?: string }
      const price = Number(payload.price)
      if (Number.isFinite(price) && price > 0) return { price, provider: provider.name }
    } catch {
      // Try the next public endpoint.
    }
  }
  return null
}

export async function getLivePrice(asset: string): Promise<LivePrice> {
  const mapping = resolveSymbol(asset)
  if (mapping.source === 'BINANCE') {
    const tick = getBinanceLivePrice(mapping.mappedSymbol)
    if (tick) {
      const parts = previousParts(mapping.originalAsset, tick.price, tick.previousPrice)
      return {
        asset: mapping.originalAsset,
        mappedSymbol: mapping.mappedSymbol,
        price: tick.price,
        previousPrice: parts.previousPrice,
        change: parts.change,
        changePercent: parts.changePercent,
        provider: tick.provider,
        feedType: 'REALTIME_TICK',
        lastPriceUpdate: tick.lastPriceUpdate,
        isDynamicPriceAvailable: true,
        validForPaperPositionTracking: true,
        validForScalping: false,
        message: `${mapping.originalAsset} usa ${tick.provider} WebSocket publico (${mapping.mappedSymbol}). Paper only.`,
      }
    }
    try {
      const restPrice = await binanceRest(mapping.mappedSymbol)
      if (restPrice) {
        const parts = previousParts(mapping.originalAsset, restPrice.price)
        return {
          asset: mapping.originalAsset,
          mappedSymbol: mapping.mappedSymbol,
          price: restPrice.price,
          previousPrice: parts.previousPrice,
          change: parts.change,
          changePercent: parts.changePercent,
          provider: restPrice.provider,
          feedType: 'DELAYED_INTRADAY',
          lastPriceUpdate: new Date().toISOString(),
          isDynamicPriceAvailable: true,
          validForPaperPositionTracking: true,
          validForScalping: false,
          message: `${restPrice.provider} fallback publico mientras llegan ticks WebSocket. No scalping.`,
        }
      }
    } catch {
      // explicit error below
    }
  }

  return {
    asset: mapping.originalAsset,
    mappedSymbol: mapping.mappedSymbol,
    price: 0,
    previousPrice: 0,
    change: 0,
    changePercent: 0,
    provider: 'Unavailable',
    feedType: 'ERROR',
    lastPriceUpdate: new Date().toISOString(),
    isDynamicPriceAvailable: false,
    validForPaperPositionTracking: false,
    validForScalping: false,
    message: `No hay feed operativo para ${mapping.originalAsset}.`,
  }
}

export async function getLivePrices(assets: string[]) {
  return Promise.all([...new Set(assets)].map((asset) => getLivePrice(asset)))
}

export function getFeedStatuses() {
  return {
    binance: getBinanceStatus(),
    alpaca: { status: 'NOT_CONFIGURED' as const },
    finnhub: { status: 'NOT_CONFIGURED' as const },
  }
}
