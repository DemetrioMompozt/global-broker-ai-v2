import type { AssetClass } from '../symbols/cfdInstrumentRegistry.js'

export function assessCfdSession(assetClass: AssetClass) {
  if (assetClass === 'CRYPTO_CFD') return { sessionAssessment: '24_7' as const, marketOpen: true, reason: 'Cripto CFD paper puede observarse 24/7 con Binance.' }
  if (assetClass === 'FOREX_CFD' || assetClass === 'METAL_CFD') return { sessionAssessment: '24_5' as const, marketOpen: true, reason: 'Preparado para sesion 24/5 cuando VT Markets demo este conectado.' }
  return { sessionAssessment: 'MARKET_HOURS' as const, marketOpen: true, reason: 'Indices/acciones dependen del feed broker o proxy configurado.' }
}
