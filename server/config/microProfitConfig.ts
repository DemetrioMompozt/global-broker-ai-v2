import { numEnv } from './env.js'

export type MicroProfitTarget = 1 | 2 | 3

export const microProfitConfig = {
  mode: 'MICRO_PROFIT_CFD_DEMO_MODE',
  targetOptionsUsd: [1, 2, 3] as MicroProfitTarget[],
  defaultTargetNetUsd: numEnv('MICRO_PROFIT_DEFAULT_TARGET_USD', 2),
  maxDailyTrades: numEnv('MICRO_PROFIT_MAX_DAILY_TRADES', 100),
  maxTradesPerHour: numEnv('MICRO_PROFIT_MAX_TRADES_PER_HOUR', 15),
  maxOpenPositions: numEnv('MICRO_PROFIT_MAX_OPEN_POSITIONS', 1),
  maxConcurrentSymbols: numEnv('MICRO_PROFIT_MAX_CONCURRENT_SYMBOLS', 1),
  maxLossPerTradeUsd: numEnv('MICRO_PROFIT_MAX_LOSS_PER_TRADE_USD', 10),
  dailyStopLossUsd: numEnv('MICRO_PROFIT_DAILY_STOP_LOSS_USD', 25),
  dailyTargetUsd: numEnv('MICRO_PROFIT_DAILY_TARGET_USD', 100),
  maxConsecutiveLosses: numEnv('MICRO_PROFIT_MAX_CONSECUTIVE_LOSSES', 3),
  cooldownAfterLossSeconds: numEnv('MICRO_PROFIT_COOLDOWN_AFTER_LOSS_SECONDS', 120),
  cooldownAfterWinSeconds: numEnv('MICRO_PROFIT_COOLDOWN_AFTER_WIN_SECONDS', 20),
  maxHoldSeconds: numEnv('MICRO_PROFIT_MAX_HOLD_SECONDS', 300),
  maxSpreadCostRatio: 0.35,
  maxTotalCostRatio: 0.55,
}

let activeTargetNetUsd = normalizeTarget(numEnv('MICRO_PROFIT_TARGET_NET_USD', microProfitConfig.defaultTargetNetUsd))

export function normalizeTarget(value: number): MicroProfitTarget {
  if (value === 1 || value === 2 || value === 3) return value
  return 2
}

export function getMicroProfitTargetNetUsd() {
  return activeTargetNetUsd
}

export function setMicroProfitTargetNetUsd(value: number) {
  activeTargetNetUsd = normalizeTarget(value)
  return activeTargetNetUsd
}

export function getMicroProfitCostLimits(targetNetUsd: number = activeTargetNetUsd) {
  return {
    maxSpreadCostUsd: Number((targetNetUsd * microProfitConfig.maxSpreadCostRatio).toFixed(2)),
    maxTotalEstimatedCostUsd: Number((targetNetUsd * microProfitConfig.maxTotalCostRatio).toFixed(2)),
    maxCostToProfitRatio: microProfitConfig.maxTotalCostRatio,
  }
}

export function getMicroProfitStatus() {
  const targetNetUsd = getMicroProfitTargetNetUsd()
  return {
    mode: microProfitConfig.mode,
    enabled: true,
    targetNetUsd,
    targetOptionsUsd: microProfitConfig.targetOptionsUsd,
    defaultTargetUsd: normalizeTarget(microProfitConfig.defaultTargetNetUsd),
    recommendedTargetUsd: 2,
    limits: {
      maxDailyTrades: microProfitConfig.maxDailyTrades,
      maxTradesPerHour: microProfitConfig.maxTradesPerHour,
      maxOpenPositions: microProfitConfig.maxOpenPositions,
      maxConcurrentSymbols: microProfitConfig.maxConcurrentSymbols,
      maxLossPerTradeUsd: microProfitConfig.maxLossPerTradeUsd,
      dailyStopLossUsd: microProfitConfig.dailyStopLossUsd,
      dailyTargetUsd: microProfitConfig.dailyTargetUsd,
      maxConsecutiveLosses: microProfitConfig.maxConsecutiveLosses,
      cooldownAfterLossSeconds: microProfitConfig.cooldownAfterLossSeconds,
      cooldownAfterWinSeconds: microProfitConfig.cooldownAfterWinSeconds,
      maxHoldSeconds: microProfitConfig.maxHoldSeconds,
    },
    costLimits: getMicroProfitCostLimits(targetNetUsd),
  }
}
