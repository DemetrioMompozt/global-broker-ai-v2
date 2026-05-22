export function vtCandidates(internalSymbol: string) {
  const key = internalSymbol.toUpperCase().replace('.CFD', '')
  const map: Record<string, string[]> = {
    BTCUSD: ['BTCUSD', 'BTCUSD.', 'BTCUSDm', 'BTCUSD.r', 'BTCUSD.pro'],
    ETHUSD: ['ETHUSD', 'ETHUSD.', 'ETHUSDm'],
    NAS100: ['NAS100', 'NAS100.', 'NAS100ft.', 'NAS100.cash', 'US100', 'USTEC', 'US100.cash'],
    US500: ['US500', 'SPX500', 'US500.cash', 'SP500', 'SP500.', 'SP500ft.', 'SPX'],
    US30: ['US30', 'DJ30', 'US30.cash'],
    XAUUSD: ['XAUUSD', 'XAUUSD.', 'XAUUSD.crp', 'XAUUSD-VIP', 'GOLD'],
    EURUSD: ['EURUSD', 'EURUSD.', 'EURUSDm'],
    GBPUSD: ['GBPUSD', 'GBPUSD.', 'GBPUSDm'],
    USDJPY: ['USDJPY', 'USDJPY.', 'USDJPYm'],
    USDCHF: ['USDCHF', 'USDCHF.', 'USDCHFm', 'USDCHF-VIP'],
  }
  return map[key] ?? [key]
}

export function mapVtMarketsSymbol(internalSymbol: string, availableSymbols: string[]) {
  const candidates = vtCandidates(internalSymbol)
  const availableUpper = new Map(availableSymbols.map((symbol) => [symbol.toUpperCase(), symbol]))
  const matches = candidates.map((candidate) => availableUpper.get(candidate.toUpperCase())).filter((item): item is string => Boolean(item))
  return {
    internalSymbol,
    brokerSymbol: matches[0] ?? null,
    broker: 'VT Markets',
    platform: 'MT5',
    mappingStatus: matches.length === 0 ? 'NOT_FOUND' : matches.length === 1 ? 'MATCHED' : 'MULTIPLE_MATCHES',
    candidates,
  }
}
