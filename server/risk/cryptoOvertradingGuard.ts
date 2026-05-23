let lastOpenAt = 0
let lastCloseAt = 0
let hourlyTrades: number[] = []

function numEnv(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

const limits = {
  cooldownAfterCloseSeconds: numEnv('CRYPTO_PAPER_COOLDOWN_AFTER_CLOSE_SECONDS', numEnv('MICRO_PROFIT_COOLDOWN_AFTER_WIN_SECONDS', 20)),
  cooldownAfterOpenSeconds: numEnv('CRYPTO_PAPER_COOLDOWN_AFTER_OPEN_SECONDS', 5),
  maxTradesPerHour: numEnv('CRYPTO_PAPER_MAX_TRADES_PER_HOUR', numEnv('MICRO_PROFIT_MAX_TRADES_PER_HOUR', 15)),
}

export function recordCryptoOpen() {
  lastOpenAt = Date.now()
  hourlyTrades.push(lastOpenAt)
  hourlyTrades = hourlyTrades.filter((time) => Date.now() - time < 60 * 60 * 1000)
}

export function recordCryptoClose() {
  lastCloseAt = Date.now()
}

export function validateCryptoOvertradingGuard() {
  hourlyTrades = hourlyTrades.filter((time) => Date.now() - time < 60 * 60 * 1000)
  if (Date.now() - lastOpenAt < limits.cooldownAfterOpenSeconds * 1000) return { approved: false, status: 'BLOCKED_BY_COOLDOWN' as const, reason: `Cooldown de ${limits.cooldownAfterOpenSeconds}s despues de abrir cripto.` }
  if (Date.now() - lastCloseAt < limits.cooldownAfterCloseSeconds * 1000) return { approved: false, status: 'BLOCKED_BY_RECENT_CLOSE' as const, reason: `Cooldown de ${limits.cooldownAfterCloseSeconds}s despues de cierre cripto.` }
  if (hourlyTrades.length >= limits.maxTradesPerHour) return { approved: false, status: 'BLOCKED_BY_MAX_TRADES_PER_HOUR' as const, reason: `Maximo ${limits.maxTradesPerHour} trades cripto por hora.` }
  return { approved: true, status: 'APPROVED' as const, reason: 'Crypto overtrading guard aprobado.' }
}
