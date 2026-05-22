import type { AgentEffectivenessStatus } from '../../types/trading'

const money = new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency', maximumFractionDigits: 4 })

function timeLabel(seconds: number | null) {
  if (seconds === null) return 'muestra insuficiente'
  if (seconds < 60) return `${seconds.toFixed(0)}s`
  return `${(seconds / 60).toFixed(1)}m`
}

export function AgentEffectivenessMonitor({ effectiveness }: { effectiveness: AgentEffectivenessStatus }) {
  const tone = effectiveness.status === 'EFFECTIVE'
    ? 'gain'
    : effectiveness.status === 'WEAK' || effectiveness.status === 'INEFFICIENT'
      ? 'loss'
      : ''

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Agent Effectiveness Monitor</div>
          <h3 className={tone}>{effectiveness.status}</h3>
          <p className="muted">{effectiveness.reason}</p>
        </div>
        <div className="big">Score {effectiveness.score}</div>
      </div>
      <div className="position-metrics">
        <span>Abiertas: <strong>{effectiveness.openPositions}</strong></span>
        <span>Cerradas hoy: <strong>{effectiveness.closedToday}</strong></span>
        <span>Targets $2: <strong>{effectiveness.targetHitsToday}</strong></span>
        <span>Cierres perdida: <strong>{effectiveness.closedByLossToday}</strong></span>
        <span>Rotaciones: <strong>{effectiveness.rotationsToday}</strong></span>
        <span>Stale/time stop: <strong>{effectiveness.staleClosuresToday}</strong></span>
        <span>Net profit hoy: <strong>{money.format(effectiveness.netProfitToday)}</strong></span>
        <span>Open P/L: <strong>{money.format(effectiveness.openPnl)}</strong></span>
        <span>Closed P/L: <strong>{money.format(effectiveness.closedPnl)}</strong></span>
        <span>Profit factor: <strong>{effectiveness.profitFactorDisplay}</strong></span>
        <span>Expected payoff: <strong>{money.format(effectiveness.expectedPayoff)}</strong></span>
        <span>Win rate: <strong>{effectiveness.winRate.toFixed(1)}%</strong></span>
        <span>Avg net win: <strong>{money.format(effectiveness.averageNetWin)}</strong></span>
        <span>Avg net loss: <strong>{money.format(effectiveness.averageNetLoss)}</strong></span>
        <span>Tiempo a $2: <strong>{timeLabel(effectiveness.averageTimeToTargetSeconds)}</strong></span>
        <span>Estancadas: <strong>{effectiveness.stalePositions}</strong></span>
        <span>Min margin level: <strong>{effectiveness.minMarginLevel.toFixed(0)}%</strong></span>
        <span>Min free margin: <strong>{money.format(effectiveness.minFreeMargin)}</strong></span>
        <span>Bloqueadas: <strong>{effectiveness.opportunitiesBlocked}</strong></span>
        <span>Razon bloqueo: <strong>{effectiveness.principalBlockingReason ?? 'sin bloqueos'}</strong></span>
        <span>Razon cierre: <strong>{effectiveness.principalClosureReason ?? 'sin cierres'}</strong></span>
      </div>
    </section>
  )
}
