import { buildLiquidityMapContext, type LiquidityMapContext } from './liquidityMapAdapter.js'

export type BookmapLiquidityLayerStatus = LiquidityMapContext & {
  absorption: boolean | null
  largeExecutedVolume: boolean | null
  liquidityPulling: boolean | null
  liquidityStacking: boolean | null
  liquidityWall: boolean | null
  passiveLiquidityAbove: number | null
  passiveLiquidityBelow: number | null
}

export function buildBookmapLiquidityLayer(input: Partial<BookmapLiquidityLayerStatus> = {}): BookmapLiquidityLayerStatus {
  const base = buildLiquidityMapContext(input)
  return {
    ...base,
    absorption: input.absorption ?? null,
    largeExecutedVolume: input.largeExecutedVolume ?? null,
    liquidityPulling: input.liquidityPulling ?? null,
    liquidityStacking: input.liquidityStacking ?? null,
    liquidityWall: input.liquidityWall ?? null,
    passiveLiquidityAbove: input.passiveLiquidityAbove ?? base.nearestLiquidityAbove,
    passiveLiquidityBelow: input.passiveLiquidityBelow ?? base.nearestLiquidityBelow,
  }
}
