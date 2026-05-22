export function estimateCfdCosts(input: {
  expectedProfit: number
  positionSize: number
  spread: number
  overnight: boolean
  targetNetUsd?: number
}) {
  const targetNetUsd = input.targetNetUsd ?? input.expectedProfit
  const spreadCost = input.spread * input.positionSize
  const estimatedCommission = 0
  const overnightSwapEstimate = input.overnight ? Math.abs(input.expectedProfit) * 0.03 : 0
  const totalEstimatedCost = spreadCost + estimatedCommission + overnightSwapEstimate
  const costToProfitRatio = targetNetUsd > 0 ? totalEstimatedCost / targetNetUsd : Infinity
  return {
    spreadCost,
    estimatedCommission,
    overnightSwapEstimate,
    totalEstimatedCost,
    costToProfitRatio,
    costAssessment: costToProfitRatio > 0.45 ? 'BLOCKING' : costToProfitRatio > 0.28 ? 'HIGH' : costToProfitRatio > 0.12 ? 'ACCEPTABLE' : 'LOW',
  } as const
}
