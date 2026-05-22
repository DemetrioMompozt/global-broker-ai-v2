import { getSymbols, getTick, getStatus } from '../broker/vtMarketsConnector.js'
import { mapVtMarketsSymbol } from '../symbols/vtMarketsSymbolMapper.js'

export type VtMarketsCfdPrice = {
  accountMode: 'DEMO'
  ask: number
  bid: number
  brokerTime: string | null
  brokerSymbol: string | null
  cfdSymbol: string
  feedType: 'BROKER_DEMO_REALTIME'
  lastPriceUpdate: string
  mid: number
  pricingQuality: 'LIVE_BID_ASK'
  provider: 'VT Markets MT5 Demo'
  readOnly: true
  spread: number
  spreadBps: number
}

export async function getVtMarketsCfdPrice(cfdSymbol: string): Promise<VtMarketsCfdPrice | null> {
  const status = await getStatus()
  if (status.status !== 'CONNECTED_DEMO_READ_ONLY') return null
  const symbols = await getSymbols()
  const mapping = mapVtMarketsSymbol(cfdSymbol, symbols)
  if (!mapping.brokerSymbol) return null
  const tick = await getTick(mapping.brokerSymbol)
  if (!tick) return null
  return {
    accountMode: 'DEMO',
    ask: tick.ask,
    bid: tick.bid,
    brokerTime: tick.brokerTime,
    brokerSymbol: mapping.brokerSymbol,
    cfdSymbol,
    feedType: 'BROKER_DEMO_REALTIME',
    lastPriceUpdate: tick.lastPriceUpdate,
    mid: tick.mid,
    pricingQuality: 'LIVE_BID_ASK',
    provider: 'VT Markets MT5 Demo',
    readOnly: true,
    spread: tick.spread,
    spreadBps: tick.spreadBps,
  }
}
