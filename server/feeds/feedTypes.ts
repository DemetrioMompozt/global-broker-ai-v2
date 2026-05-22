export type FeedType =
  | 'REALTIME_TICK'
  | 'REALTIME_INTRADAY_IEX'
  | 'DELAYED_INTRADAY'
  | 'BENCHMARK_DAILY'
  | 'BROKER_DEMO_REALTIME'
  | 'MOCK_DATA'
  | 'STALE_DATA'
  | 'ERROR'

export type ProviderStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'ERROR' | 'NOT_CONFIGURED'

export type LivePrice = {
  asset: string
  mappedSymbol: string
  price: number
  previousPrice: number
  change: number
  changePercent: number
  bid?: number
  ask?: number
  spread?: number
  spreadBps?: number
  provider: string
  feedType: FeedType
  lastPriceUpdate: string
  isDynamicPriceAvailable: boolean
  validForPaperPositionTracking: boolean
  validForScalping: false
  message: string
}
