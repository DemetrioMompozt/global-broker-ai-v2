import type { AssetClass } from '../symbols/cfdInstrumentRegistry.js'

export function routeStrategy(assetClass: AssetClass, momentumScore: number) {
  if (assetClass === 'CRYPTO_CFD') return momentumScore >= 75 ? 'MomentumContinuation' : 'BreakoutConfirmed'
  if (assetClass === 'INDEX_CFD') return 'PullbackContinuation'
  if (assetClass === 'FOREX_CFD') return 'SessionMomentum'
  return 'BreakoutConfirmed'
}
