import { getSafetyConfig, hasRealTradingViolation } from '../config/safetyConfig.js'

export function getKillSwitchStatus() {
  const triggered = hasRealTradingViolation()
  return {
    status: triggered ? 'TRIGGERED' as const : 'CLEAR' as const,
    triggered,
    reasons: triggered ? ['Configuracion de ejecucion/order-send detectada. Todo queda bloqueado.'] : [],
    safety: getSafetyConfig(),
  }
}
