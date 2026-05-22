export function calculateMargin(input: {
  equity: number
  usedMargin: number
  notionalExposure: number
  leverage: number
}) {
  const requiredMargin = input.leverage > 0 ? input.notionalExposure / input.leverage : input.notionalExposure
  const postUsedMargin = input.usedMargin + requiredMargin
  const freeMargin = input.equity - postUsedMargin
  const marginLevel = postUsedMargin > 0 ? input.equity / postUsedMargin * 100 : 9999
  return {
    requiredMargin,
    postUsedMargin,
    freeMargin,
    marginLevel,
    marginAssessment: marginLevel < 105 || freeMargin < 0 ? 'DANGEROUS' : marginLevel < 180 ? 'WATCH' : 'HEALTHY',
  } as const
}
