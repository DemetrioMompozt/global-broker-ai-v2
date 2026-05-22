import { getOpenPositions, type CfdPosition } from '../storage/tradeStore.js'

export const multiPositionLimits = {
  maxTotalOpenPositions: 10,
  maxVtOpenPositions: 8,
  maxBinanceCryptoOpenPositions: 1,
  maxPositionsPerAssetClass: 6,
  maxPositionsPerSymbol: 1,
  maxTotalOpenRiskPercent: 4.5,
  maxCryptoRiskPerTradePercent: 0.4,
  maxForexRiskPerTradePercent: 0.45,
  maxIndexRiskPerTradePercent: 0.45,
  maxMetalRiskPerTradePercent: 0.45,
  maxRiskPerTradePercent: 0.45,
}

function sourceOf(position: Pick<CfdPosition, 'provider' | 'source'>) {
  if (position.source) return position.source
  return position.provider.includes('VT Markets') ? 'VT_MARKETS_MT5_DEMO' : 'BINANCE_REALTIME'
}

function isHighlyCorrelated(open: CfdPosition[], input: { assetClass: string; cfdSymbol: string; direction: 'LONG' | 'SHORT' }) {
  if (input.assetClass === 'INDEX_CFD') {
    return open.some((position) => position.assetClass === 'INDEX_CFD' && position.direction === input.direction)
  }
  if (input.assetClass === 'FOREX_CFD' && ['EURUSD.cfd', 'GBPUSD.cfd'].includes(input.cfdSymbol)) {
    return open.some((position) => ['EURUSD.cfd', 'GBPUSD.cfd'].includes(position.cfdSymbol) && position.direction === input.direction)
  }
  return false
}

export function validateMultiPositionPortfolioPolicy(input: {
  assetClass: string
  cfdSymbol: string
  direction: 'LONG' | 'SHORT'
  riskPercent: number
  source: 'BINANCE_REALTIME' | 'VT_MARKETS_MT5_DEMO'
}) {
  const open = getOpenPositions()
  const reasons: string[] = []
  const sameSymbol = open.filter((position) => position.cfdSymbol === input.cfdSymbol).length
  const sameClass = open.filter((position) => position.assetClass === input.assetClass).length
  const vtOpen = open.filter((position) => sourceOf(position) === 'VT_MARKETS_MT5_DEMO').length
  const cryptoOpen = open.filter((position) => position.assetClass === 'CRYPTO_CFD').length
  const totalRisk = open.reduce((sum, position) => sum + position.riskPercent, 0) + input.riskPercent

  if (open.length >= multiPositionLimits.maxTotalOpenPositions) reasons.push('MAX_TOTAL_OPEN_POSITIONS alcanzado.')
  if (sameSymbol >= multiPositionLimits.maxPositionsPerSymbol) reasons.push('MAX_POSITIONS_PER_SYMBOL: ya existe una posicion en este simbolo.')
  if (sameClass >= multiPositionLimits.maxPositionsPerAssetClass) reasons.push('MAX_POSITIONS_PER_ASSET_CLASS alcanzado.')
  if (input.source === 'VT_MARKETS_MT5_DEMO' && vtOpen >= multiPositionLimits.maxVtOpenPositions) reasons.push('MAX_VT_OPEN_POSITIONS alcanzado.')
  if (input.assetClass === 'CRYPTO_CFD' && cryptoOpen >= multiPositionLimits.maxBinanceCryptoOpenPositions) reasons.push('MAX_BINANCE_CRYPTO_OPEN_POSITIONS alcanzado.')
  if (totalRisk > multiPositionLimits.maxTotalOpenRiskPercent) reasons.push('MAX_TOTAL_OPEN_RISK_PERCENT excedido.')
  if (isHighlyCorrelated(open, input) && input.assetClass === 'INDEX_CFD') reasons.push('Correlacion alta: ya existe indice CFD en la misma direccion.')
  if (isHighlyCorrelated(open, input) && sameClass >= 2) reasons.push('Correlacion alta con demasiadas posiciones abiertas en la misma direccion.')

  return {
    approved: reasons.length === 0,
    reasons,
    slotsAvailable: Math.max(0, multiPositionLimits.maxTotalOpenPositions - open.length),
    sourceCounts: {
      binance: cryptoOpen,
      vtMarkets: vtOpen,
    },
    status: reasons.length === 0 ? 'APPROVED' as const : 'BLOCKED' as const,
    totalRisk,
  }
}
