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
    { name: 'Binance REST', baseUrl: 'https://api.binance.com/api/v3' },
    { name: 'Binance.US REST', baseUrl: 'https://api.binance.us/api/v3' },
  ]) {
    try {
      const book = await fetch(`${provider.baseUrl}/ticker/bookTicker?symbol=${encodeURIComponent(symbol)}`)
      if (book.ok) {
        const payload = await book.json() as { askPrice?: string; bidPrice?: string }
        const bid = Number(payload.bidPrice)
        const ask = Number(payload.askPrice)
        if (Number.isFinite(bid) && bid > 0 && Number.isFinite(ask) && ask > bid) {
          return {
            ask,
            bid,
            price: (bid + ask) / 2,
            provider: `${provider.name} bookTicker`,
            spread: ask - bid,
            spreadBps: (ask - bid) / ((bid + ask) / 2) * 10_000,
          }
        }
      }
      const response = await fetch(`${provider.baseUrl}/ticker/price?symbol=${encodeURIComponent(symbol)}`)
      if (response.ok) {
        const payload = await response.json() as { price?: string }
        const price = Number(payload.price)
        if (Number.isFinite(price) && price > 0) return { price, provider: provider.name }
      }
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
        ask: tick.ask,
        bid: tick.bid,
        spread: tick.spread,
        spreadBps: tick.spreadBps,
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
          ask: restPrice.ask,
          bid: restPrice.bid,
          spread: restPrice.spread,
          spreadBps: restPrice.spreadBps,
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
