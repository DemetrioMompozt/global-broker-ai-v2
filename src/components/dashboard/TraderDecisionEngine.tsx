import type { TraderDecisionStatus } from '../../types/trading'

export function TraderDecisionEngine({ decision }: { decision: TraderDecisionStatus }) {
  return (
    <section className="panel">
      <div className="eyebrow">Trader Decision Engine</div>
      <h3>{decision.accountHealth}</h3>
      <div className="position-metrics">
        <span>Accion actual: <strong>{decision.action}</strong></span>
        <span>Max posiciones permitido ahora: <strong>{decision.maxAllowedOpenPositions}</strong></span>
        <span>Mejor oportunidad nueva: <strong>{decision.bestOpportunity ?? '-'}</strong></span>
        <span>Nuevas entradas: <strong>{decision.blockNewEntries ? 'bloqueadas' : 'permitidas'}</strong></span>
      </div>
      {decision.weakestPosition ? (
        <p className="reason">
          Posicion mas debil: <strong>{decision.weakestPosition.cfdSymbol}</strong> · P/L {decision.weakestPosition.openPnl.toFixed(4)} · score {decision.weakestPosition.positionQualityScore.toFixed(0)}. {decision.weakestPosition.reason}
        </p>
      ) : null}
      <p className={decision.accountHealth === 'HEALTHY' ? 'reason' : 'warning'}>{decision.reason}</p>
    </section>
  )
}
