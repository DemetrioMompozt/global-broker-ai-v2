export type AssetClass = 'CRYPTO_CFD' | 'INDEX_CFD' | 'FOREX_CFD' | 'METAL_CFD' | 'EQUITY_CFD'

export type CfdInstrument = {
  cfdSymbol: string
  underlyingSymbol: string
  assetClass: AssetClass
  maxLeverage: number
  defaultLeverage: number
  minRiskPercent: number
  maxRiskPercent: number
  session: '24_7' | '24_5' | 'MARKET_HOURS'
}

const instruments: CfdInstrument[] = [
  { cfdSymbol: 'BTCUSD.cfd', underlyingSymbol: 'BTCUSDT', assetClass: 'CRYPTO_CFD', maxLeverage: 1, defaultLeverage: 1, minRiskPercent: 0.1, maxRiskPercent: 0.4, session: '24_7' },
  { cfdSymbol: 'ETHUSD.cfd', underlyingSymbol: 'ETHUSDT', assetClass: 'CRYPTO_CFD', maxLeverage: 1, defaultLeverage: 1, minRiskPercent: 0.1, maxRiskPercent: 0.4, session: '24_7' },
  { cfdSymbol: 'SOLUSD.cfd', underlyingSymbol: 'SOLUSDT', assetClass: 'CRYPTO_CFD', maxLeverage: 1, defaultLeverage: 1, minRiskPercent: 0.1, maxRiskPercent: 0.4, session: '24_7' },
  { cfdSymbol: 'XRPUSD.cfd', underlyingSymbol: 'XRPUSDT', assetClass: 'CRYPTO_CFD', maxLeverage: 1, defaultLeverage: 1, minRiskPercent: 0.1, maxRiskPercent: 0.4, session: '24_7' },
  { cfdSymbol: 'NAS100.cfd', underlyingSymbol: 'QQQ', assetClass: 'INDEX_CFD', maxLeverage: 25, defaultLeverage: 1, minRiskPercent: 0.15, maxRiskPercent: 0.45, session: 'MARKET_HOURS' },
  { cfdSymbol: 'US500.cfd', underlyingSymbol: 'SPY', assetClass: 'INDEX_CFD', maxLeverage: 25, defaultLeverage: 1, minRiskPercent: 0.15, maxRiskPercent: 0.45, session: 'MARKET_HOURS' },
  { cfdSymbol: 'XAUUSD.cfd', underlyingSymbol: 'XAUUSD', assetClass: 'METAL_CFD', maxLeverage: 25, defaultLeverage: 1, minRiskPercent: 0.15, maxRiskPercent: 0.45, session: '24_5' },
  { cfdSymbol: 'EURUSD.cfd', underlyingSymbol: 'EURUSD', assetClass: 'FOREX_CFD', maxLeverage: 25, defaultLeverage: 1, minRiskPercent: 0.15, maxRiskPercent: 0.45, session: '24_5' },
  { cfdSymbol: 'GBPUSD.cfd', underlyingSymbol: 'GBPUSD', assetClass: 'FOREX_CFD', maxLeverage: 25, defaultLeverage: 1, minRiskPercent: 0.15, maxRiskPercent: 0.45, session: '24_5' },
  { cfdSymbol: 'USDJPY.cfd', underlyingSymbol: 'USDJPY', assetClass: 'FOREX_CFD', maxLeverage: 25, defaultLeverage: 1, minRiskPercent: 0.15, maxRiskPercent: 0.45, session: '24_5' },
  { cfdSymbol: 'USDCHF.cfd', underlyingSymbol: 'USDCHF', assetClass: 'FOREX_CFD', maxLeverage: 25, defaultLeverage: 1, minRiskPercent: 0.15, maxRiskPercent: 0.45, session: '24_5' },
]

export function getCfdInstrument(symbol: string) {
  const normalized = symbol.trim().toUpperCase().replace('.CFD', '')
  return instruments.find((item) => item.cfdSymbol.toUpperCase().replace('.CFD', '') === normalized)
    ?? instruments.find((item) => item.underlyingSymbol.toUpperCase() === normalized)
}

export function getTradableInstruments() {
  return [...instruments]
}
