import { boolEnv } from './env.js'

export const safetyConfig = {
  brokerExecutionEnabled: boolEnv('BROKER_EXECUTION_ENABLED', false),
  liveTradingEnabled: boolEnv('LIVE_TRADING_ENABLED', false),
  mt5RealExecution: boolEnv('MT5_REAL_EXECUTION', false),
  paperOnly: true,
  realTradingAllowed: boolEnv('REAL_TRADING_ALLOWED', false),
  vtMarketsAllowOrderSend: boolEnv('VT_MARKETS_ALLOW_ORDER_SEND', false),
  vtMarketsRealTradingAllowed: boolEnv('VT_MARKETS_REAL_TRADING_ALLOWED', false),
  vtMarketsReadOnly: boolEnv('VT_MARKETS_READ_ONLY', true),
}

export function getSafetyConfig() {
  return {
    brokerExecutionEnabled: boolEnv('BROKER_EXECUTION_ENABLED', false),
    liveTradingEnabled: boolEnv('LIVE_TRADING_ENABLED', false),
    mt5RealExecution: boolEnv('MT5_REAL_EXECUTION', false),
    paperOnly: true,
    realTradingAllowed: boolEnv('REAL_TRADING_ALLOWED', false),
    vtMarketsAllowOrderSend: boolEnv('VT_MARKETS_ALLOW_ORDER_SEND', false),
    vtMarketsRealTradingAllowed: boolEnv('VT_MARKETS_REAL_TRADING_ALLOWED', false),
    vtMarketsReadOnly: boolEnv('VT_MARKETS_READ_ONLY', true),
  }
}

export function hasRealTradingViolation() {
  const current = getSafetyConfig()
  return current.realTradingAllowed
    || current.brokerExecutionEnabled
    || current.liveTradingEnabled
    || current.mt5RealExecution
    || current.vtMarketsRealTradingAllowed
    || current.vtMarketsAllowOrderSend
}
