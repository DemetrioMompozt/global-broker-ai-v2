import type { LivePrice } from '../feeds/feedTypes.js'
import { getLivePrice } from '../feeds/livePriceService.js'
import { getVtMarketsCfdPrice } from '../feeds/vtMarketsPriceProvider.js'
import { getCfdInstrument } from '../symbols/cfdInstrumentRegistry.js'

export type CfdQuote = {
  cfdSymbol: string
  underlyingSymbol: string
  bid: number
  ask: number
  brokerTime?: string | null
  mid: number
  spread: number
  spreadBps: number
  provider: string
  feedType: LivePrice['feedType']
  pricingQuality: 'LIVE_BID_ASK' | 'LIVE_MID_ESTIMATED_SPREAD' | 'ERROR'
  lastPriceUpdate: string
  sourcePrice: LivePrice
}

const lastVtMidByCfdSymbol = new Map<string, number>()

export async function getCfdQuote(cfdSymbol: string): Promise<CfdQuote> {
  const instrument = getCfdInstrument(cfdSymbol)
  if (instrument && instrument.assetClass !== 'CRYPTO_CFD') {
    const vt = await getVtMarketsCfdPrice(instrument.cfdSymbol)
    if (vt) {
      const previousPrice = lastVtMidByCfdSymbol.get(instrument.cfdSymbol) ?? vt.mid
      const change = vt.mid - previousPrice
      const changePercent = previousPrice > 0 ? change / previousPrice * 100 : 0
      lastVtMidByCfdSymbol.set(instrument.cfdSymbol, vt.mid)
      const sourcePrice: LivePrice = {
        asset: instrument.cfdSymbol,
        mappedSymbol: vt.brokerSymbol ?? instrument.underlyingSymbol,
        price: vt.mid,
        previousPrice,
        change,
        changePercent,
        bid: vt.bid,
        ask: vt.ask,
        spread: vt.spread,
        spreadBps: vt.spreadBps,
        provider: vt.provider,
        feedType: vt.feedType,
        lastPriceUpdate: vt.lastPriceUpdate,
        isDynamicPriceAvailable: true,
        validForPaperPositionTracking: true,
        validForScalping: false,
        message: `${instrument.cfdSymbol} usa VT Markets MT5 Demo read-only. Ejecucion interna paper.`,
      }
      return {
        cfdSymbol: instrument.cfdSymbol,
        underlyingSymbol: vt.brokerSymbol ?? instrument.underlyingSymbol,
        brokerTime: vt.brokerTime,
        bid: vt.bid,
        ask: vt.ask,
        mid: vt.mid,
        spread: vt.spread,
        spreadBps: vt.spreadBps,
        provider: vt.provider,
        feedType: vt.feedType,
        pricingQuality: vt.pricingQuality,
        lastPriceUpdate: vt.lastPriceUpdate,
        sourcePrice,
      }
    }
  }
  const live = await getLivePrice(instrument?.underlyingSymbol ?? cfdSymbol)
  const fallbackSpreadBps = instrument?.assetClass === 'CRYPTO_CFD' ? 10 : 5
  const spreadBps = Number.isFinite(live.spreadBps) && (live.spreadBps ?? 0) > 0 ? live.spreadBps! : fallbackSpreadBps
  const spread = Number.isFinite(live.spread) && (live.spread ?? 0) > 0 ? live.spread! : live.price > 0 ? live.price * spreadBps / 10_000 : 0
  const bid = live.bid ?? Math.max(0, live.price - spread / 2)
  const ask = live.ask ?? live.price + spread / 2
  const mid = (bid + ask) / 2

  return {
    cfdSymbol: instrument?.cfdSymbol ?? cfdSymbol,
    underlyingSymbol: instrument?.underlyingSymbol ?? live.mappedSymbol,
    bid,
    ask,
    mid,
    spread,
    spreadBps,
    provider: live.provider,
    feedType: live.feedType,
    pricingQuality: live.feedType === 'REALTIME_TICK' ? 'LIVE_MID_ESTIMATED_SPREAD' : live.price > 0 ? 'LIVE_MID_ESTIMATED_SPREAD' : 'ERROR',
    lastPriceUpdate: live.lastPriceUpdate,
    sourcePrice: live,
  }
}
