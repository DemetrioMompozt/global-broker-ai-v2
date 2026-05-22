export type SymbolMapping = {
  originalAsset: string
  mappedSymbol: string
  source: 'BINANCE' | 'VT_MARKETS' | 'UNAVAILABLE'
  mappingType: 'CRYPTO_CFD' | 'BROKER_CFD' | 'UNKNOWN'
  note: string
}

const cryptoMap: Record<string, string> = {
  'BTCUSD': 'BTCUSDT',
  'BTCUSD.CFD': 'BTCUSDT',
  'BTCUSDT': 'BTCUSDT',
  'ETHUSD': 'ETHUSDT',
  'ETHUSD.CFD': 'ETHUSDT',
  'ETHUSDT': 'ETHUSDT',
  'SOLUSD': 'SOLUSDT',
  'SOLUSD.CFD': 'SOLUSDT',
  'SOLUSDT': 'SOLUSDT',
  'XRPUSD': 'XRPUSDT',
  'XRPUSD.CFD': 'XRPUSDT',
  'XRPUSDT': 'XRPUSDT',
}

export function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase()
}

export function resolveSymbol(asset: string): SymbolMapping {
  const key = normalizeSymbol(asset)
  const crypto = cryptoMap[key]
  if (crypto) {
    return {
      originalAsset: key.endsWith('.CFD') ? key : `${key.replace(/USDT$/, 'USD')}.cfd`,
      mappedSymbol: crypto,
      source: 'BINANCE',
      mappingType: 'CRYPTO_CFD',
      note: `${key} se valora con ${crypto} por Binance para CFD paper. No hay ejecucion real.`,
    }
  }
  return {
    originalAsset: key,
    mappedSymbol: key,
    source: 'UNAVAILABLE',
    mappingType: 'UNKNOWN',
    note: 'Simbolo preparado para VT Markets demo cuando MT5 este configurado.',
  }
}
