let lastOpenAt = 0
let lastCloseAt = 0
let hourlyTrades: number[] = []

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
  if (Date.now() - lastOpenAt < 15 * 60 * 1000) return { approved: false, status: 'BLOCKED_BY_COOLDOWN' as const, reason: 'Cooldown de 15 minutos despues de abrir cripto.' }
  if (Date.now() - lastCloseAt < 20 * 60 * 1000) return { approved: false, status: 'BLOCKED_BY_RECENT_CLOSE' as const, reason: 'Cooldown de 20 minutos despues de cierre cripto.' }
  if (hourlyTrades.length >= 2) return { approved: false, status: 'BLOCKED_BY_MAX_TRADES_PER_HOUR' as const, reason: 'Maximo 2 trades cripto por hora.' }
  return { approved: true, status: 'APPROVED' as const, reason: 'Crypto overtrading guard aprobado.' }
}
