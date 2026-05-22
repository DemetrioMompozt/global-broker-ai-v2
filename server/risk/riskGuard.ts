import { tradingConfig } from '../config/tradingConfig.js'

export function validateRiskGuard(input: { riskPercent: number; riskReward: number }) {
  const reasons: string[] = []
  if (input.riskPercent > tradingConfig.riskPerTradePercent) reasons.push('Riesgo por trade excede limite.')
  if (input.riskReward < tradingConfig.minRiskReward) reasons.push('R/R menor a 2.0.')
  return {
    approved: reasons.length === 0,
    status: reasons.length === 0 ? 'APPROVED' as const : 'BLOCKED' as const,
    reasons,
  }
}
