import type { LeverageDamageStatus, LossAttributionStatus, TargetFeasibilityStatus } from '../../types/trading'

const money = new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency', maximumFractionDigits: 4 })

function verdictLabel(verdict: string) {
  if (verdict === 'target_2_viable') return 'Target $2 viable'
  if (verdict === 'target_2_too_small_for_costs') return 'Target $2 consumido por costos'
  if (verdict === 'target_2_not_reached_consistently') return 'Target $2 no se alcanza con consistencia'
  if (verdict === 'insufficient_data') return 'Muestra insuficiente'
  return 'En observacion'
}

export function LossAttributionPanel({
  attribution,
  leverage,
  target,
}: {
  attribution: LossAttributionStatus
  leverage: LeverageDamageStatus
  target: TargetFeasibilityStatus
}) {
  const worstSymbols = attribution.worstSymbols.length ? attribution.worstSymbols : attribution.symbolDiagnostics.slice(0, 3)

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Loss Attribution</div>
          <h3>{attribution.mainLossDriver}</h3>
          <p className="muted">Diagnostico de perdidas por simbolo, estrategia, costos, leverage y viabilidad del target.</p>
        </div>
        <div className={target.viable ? 'gain' : 'loss'}>{verdictLabel(target.verdict)}</div>
      </div>
      <div className="position-metrics">
        <span>Impacto costos: <strong>{money.format(attribution.costImpact)}</strong></span>
        <span>Impacto leverage: <strong>{money.format(attribution.leverageImpact)}</strong></span>
        <span>Impacto correlacion: <strong>{money.format(attribution.correlationImpact)}</strong></span>
        <span>Avg cost/target: <strong>{(target.avgCostToProfitRatio * 100).toFixed(1)}%</strong></span>
        <span>Hit rate target: <strong>{target.targetHitRate.toFixed(1)}%</strong></span>
        <span>Leverage promedio: <strong>{leverage.averageLeverage.toFixed(1)}x</strong></span>
        <span>Cierres por estres: <strong>{leverage.marginStressClosures}</strong></span>
        <span>Recomendacion leverage: <strong>{leverage.recommendation}</strong></span>
      </div>
      <div className="two-column">
        <div className="subpanel">
          <div className="eyebrow">Peores simbolos</div>
          {worstSymbols.length ? worstSymbols.map((symbol) => (
            <div className="compact-row" key={symbol.symbol}>
              <strong>{symbol.symbol}</strong>
              <span>{symbol.status}</span>
              <span>{money.format(symbol.netPnl)}</span>
              <span>PF {symbol.profitFactor === null ? 'N/A' : symbol.profitFactor.toFixed(2)}</span>
            </div>
          )) : <p className="muted">Sin cierres suficientes todavia.</p>}
        </div>
        <div className="subpanel">
          <div className="eyebrow">Recomendaciones</div>
          {attribution.recommendations.map((item) => <p className="reason" key={item}>{item}</p>)}
        </div>
      </div>
    </section>
  )
}
