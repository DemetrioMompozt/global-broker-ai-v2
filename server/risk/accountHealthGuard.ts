import type { CfdPosition } from '../storage/tradeStore.js'

export type AccountHealthState = 'HEALTHY' | 'DEFENSIVE' | 'MARGIN_WARNING' | 'CRITICAL_MARGIN_DEFENSIVE'

export type AccountSnapshot = {
  balance: number
  equity: number
  freeMargin: number
  marginLevel: number
  openPnl: number
  portfolioLeverage: number
  usedMargin: number
}

export function evaluateAccountHealth(account: AccountSnapshot, openPositions: CfdPosition[]) {
  const reasons: string[] = []
  const totalOpenRisk = openPositions.reduce((sum, position) => sum + position.riskPercent, 0)
  let state: AccountHealthState = 'HEALTHY'

  if (account.freeMargin < 0) {
    state = 'CRITICAL_MARGIN_DEFENSIVE'
    reasons.push('Free margin negativo. El agente debe liberar margen antes de operar.')
  } else if (account.freeMargin < account.equity * 0.12) {
    state = 'DEFENSIVE'
    reasons.push('Free margin menor al 12% del equity. Nuevas entradas bloqueadas hasta recuperar aire.')
  }

  if (account.marginLevel < 150) {
    state = state === 'CRITICAL_MARGIN_DEFENSIVE' ? state : 'MARGIN_WARNING'
    reasons.push('Margin level menor a 150%. Nuevas entradas bloqueadas.')
  }

  if (account.usedMargin > account.equity * 0.82) {
    if (state === 'HEALTHY') state = 'DEFENSIVE'
    reasons.push('Used margin supera 82% del equity. Reducir exposicion antes de abrir mas.')
  }

  const maxAllowedOpenPositions = state === 'HEALTHY'
    ? 10
    : state === 'CRITICAL_MARGIN_DEFENSIVE' ? 0 : 2

  return {
    accountHealth: state,
    blockNewEntries: state !== 'HEALTHY',
    maxAllowedOpenPositions,
    needsMarginRelease: state === 'CRITICAL_MARGIN_DEFENSIVE' || state === 'DEFENSIVE' || state === 'MARGIN_WARNING',
    reasons,
    totalOpenRisk,
  }
}
