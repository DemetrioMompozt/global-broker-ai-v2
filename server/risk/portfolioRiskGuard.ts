import { tradingConfig } from '../config/tradingConfig.js'
import { getOpenPositions } from '../storage/tradeStore.js'

export function validatePortfolioRiskGuard(input: { cfdSymbol: string; riskPercent: number; assetClass: string }) {
  const open = getOpenPositions()
  const reasons: string[] = []
  const totalRisk = open.reduce((sum, position) => sum + position.riskPercent, 0) + input.riskPercent
  const cryptoOpen = open.filter((position) => position.cfdSymbol.includes('BTC') || position.cfdSymbol.includes('ETH') || position.cfdSymbol.includes('SOL') || position.cfdSymbol.includes('XRP')).length
  if (open.length >= tradingConfig.maxOpenPositions) reasons.push(`Maximo de ${tradingConfig.maxOpenPositions} posiciones abiertas alcanzado.`)
  if (open.some((position) => position.cfdSymbol === input.cfdSymbol)) reasons.push('Ya existe posicion en el mismo CFD.')
  if (totalRisk > tradingConfig.maxTotalSimulatedRiskPercent) reasons.push(`Riesgo total simulado excede ${tradingConfig.maxTotalSimulatedRiskPercent.toFixed(2)}%.`)
  if (input.assetClass === 'CRYPTO_CFD' && cryptoOpen >= tradingConfig.maxCryptoPositions) reasons.push(`Maximo de ${tradingConfig.maxCryptoPositions} posiciones cripto CFD alcanzado.`)
  return {
    approved: reasons.length === 0,
    status: reasons.length === 0 ? 'APPROVED' as const : 'BLOCKED' as const,
    reasons,
    totalRisk,
  }
}
