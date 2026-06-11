export type LiquidityMapContext = {
  available: boolean
  liquidityMapAvailable: boolean
  nearestLiquidityAbove: number | null
  nearestLiquidityBelow: number | null
  orderFlowBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN'
  reason: string
}

export function buildLiquidityMapContext(input: Partial<LiquidityMapContext> = {}): LiquidityMapContext {
  return {
    available: input.available ?? false,
    liquidityMapAvailable: input.liquidityMapAvailable ?? input.available ?? false,
    nearestLiquidityAbove: input.nearestLiquidityAbove ?? null,
    nearestLiquidityBelow: input.nearestLiquidityBelow ?? null,
    orderFlowBias: input.orderFlowBias ?? 'UNKNOWN',
    reason: input.reason ?? 'Bookmap/DOM/order-flow no esta conectado; la liquidez solo se muestra como contexto y no autoriza entradas.',
  }
}
