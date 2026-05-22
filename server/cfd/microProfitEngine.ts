import { getMicroProfitCostLimits, getMicroProfitTargetNetUsd } from '../config/microProfitConfig.js'

export type MicroProfitCosts = {
  commission: number
  slippageEstimate: number
  spreadCost: number
  swapAccrued: number
  totalEstimatedCost: number
  costToProfitRatio: number
}

export function calculateMicroProfitCosts(input: {
  commission?: number
  expectedNetProfit?: number
  positionSize: number
  slippageEstimate?: number
  spread: number
  swapAccrued?: number
  targetNetUsd?: number
}) {
  const targetNetUsd = input.targetNetUsd ?? getMicroProfitTargetNetUsd()
  const spreadCost = Math.abs(input.spread * input.positionSize)
  const commission = Math.max(0, input.commission ?? 0)
  const slippageEstimate = Math.max(0, input.slippageEstimate ?? spreadCost * 0.5)
  const swapAccrued = Math.max(0, input.swapAccrued ?? 0)
  const totalEstimatedCost = spreadCost + commission + slippageEstimate + swapAccrued
  const costToProfitRatio = targetNetUsd > 0 ? totalEstimatedCost / targetNetUsd : Infinity
  return {
    commission: Number(commission.toFixed(6)),
    slippageEstimate: Number(slippageEstimate.toFixed(6)),
    spreadCost: Number(spreadCost.toFixed(6)),
    swapAccrued: Number(swapAccrued.toFixed(6)),
    totalEstimatedCost: Number(totalEstimatedCost.toFixed(6)),
    costToProfitRatio: Number(costToProfitRatio.toFixed(6)),
  }
}

export function calculateNetPnl(grossPnl: number, costs: Pick<MicroProfitCosts, 'commission' | 'slippageEstimate' | 'spreadCost' | 'swapAccrued'>) {
  return Number((grossPnl - costs.spreadCost - costs.commission - costs.slippageEstimate - costs.swapAccrued).toFixed(6))
}

export function shouldCloseForMicroTarget(input: { grossPnl: number; costs: MicroProfitCosts; targetNetUsd?: number }) {
  const targetNetUsd = input.targetNetUsd ?? getMicroProfitTargetNetUsd()
  const netPnl = calculateNetPnl(input.grossPnl, input.costs)
  return {
    close: netPnl >= targetNetUsd,
    netPnl,
    targetNetUsd,
    reason: netPnl >= targetNetUsd ? `Cierre por target neto $${targetNetUsd} alcanzado.` : `Mantener: netPnl $${netPnl.toFixed(2)} debajo del target neto $${targetNetUsd}.`,
  }
}

export function validateMicroProfitCosts(input: { costs: MicroProfitCosts; expectedNetProfit: number; targetNetUsd?: number }) {
  const targetNetUsd = input.targetNetUsd ?? getMicroProfitTargetNetUsd()
  const limits = getMicroProfitCostLimits(targetNetUsd)
  const reasons: string[] = []
  if (input.costs.spreadCost > limits.maxSpreadCostUsd) reasons.push(`spreadCost ${input.costs.spreadCost.toFixed(2)} > ${limits.maxSpreadCostUsd.toFixed(2)}`)
  if (input.costs.totalEstimatedCost > limits.maxTotalEstimatedCostUsd) reasons.push(`totalEstimatedCost ${input.costs.totalEstimatedCost.toFixed(2)} > ${limits.maxTotalEstimatedCostUsd.toFixed(2)}`)
  if (input.expectedNetProfit < targetNetUsd - 0.01) reasons.push(`expectedNetProfit ${input.expectedNetProfit.toFixed(2)} < target neto ${targetNetUsd.toFixed(2)}`)
  if (input.costs.costToProfitRatio > limits.maxCostToProfitRatio) reasons.push(`costToProfitRatio ${input.costs.costToProfitRatio.toFixed(2)} > ${limits.maxCostToProfitRatio.toFixed(2)}`)
  return {
    approved: reasons.length === 0,
    reasons,
    targetNetUsd,
    limits,
  }
}
