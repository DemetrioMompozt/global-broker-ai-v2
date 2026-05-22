export function sizeCfdPosition(input: {
  equity: number
  maxNotionalExposure?: number
  riskPercent: number
  entryPrice: number
  stopLoss: number
}) {
  const targetRiskUsd = input.equity * input.riskPercent / 100
  const stopDistance = Math.abs(input.entryPrice - input.stopLoss)
  const riskBasedPositionSize = stopDistance > 0 ? targetRiskUsd / stopDistance : 0
  const marginBasedPositionSize = input.maxNotionalExposure && input.entryPrice > 0 ? input.maxNotionalExposure / input.entryPrice : riskBasedPositionSize
  const positionSize = Math.max(0, Math.min(riskBasedPositionSize, marginBasedPositionSize))
  const riskUsd = stopDistance * positionSize
  return {
    cappedByMargin: positionSize < riskBasedPositionSize,
    riskUsd,
    riskPercent: input.equity > 0 ? riskUsd / input.equity * 100 : 0,
    positionSize,
    notionalExposure: positionSize * input.entryPrice,
  }
}
