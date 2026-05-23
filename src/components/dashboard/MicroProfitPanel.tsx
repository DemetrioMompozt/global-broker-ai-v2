import type { MicroProfitStatus } from '../../types/trading'

const money = new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency', maximumFractionDigits: 2 })

function labelForTarget(target: number) {
  if (target === 1) return '$1 neto'
  if (target === 2) return '$2 neto recomendado'
  return '$3 neto experimental'
}

export function MicroProfitPanel({ microProfit }: { microProfit: MicroProfitStatus }) {
  const localTarget = microProfit.targetNetUsd
  const costLimits = {
    maxSpreadCostUsd: localTarget * 0.2,
    maxTotalEstimatedCostUsd: localTarget * 0.3,
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">MICRO_PROFIT_CFD_DEMO_MODE</div>
          <h3>Micro target neto</h3>
          <p className="muted">Cierra solo cuando el P/L neto cubre spread, comision, slippage estimado y swap acumulado.</p>
        </div>
        <div className="auto-status-card">
          <span>Target automatico</span>
          <strong>{labelForTarget(localTarget)}</strong>
          <small>El servidor gestiona el target sin controles manuales.</small>
        </div>
      </div>
      <div className="position-metrics">
        <span>Target neto actual: <strong>{money.format(localTarget)}</strong></span>
        <span>Target recomendado: <strong>{money.format(microProfit.recommendedTargetUsd)}</strong></span>
        <span>Spread max: <strong>{money.format(costLimits.maxSpreadCostUsd)}</strong></span>
        <span>Costo total max: <strong>{money.format(costLimits.maxTotalEstimatedCostUsd)}</strong></span>
        <span>Trades hoy: <strong>{microProfit.tradesToday} / {microProfit.limits.maxDailyTrades}</strong></span>
        <span>Net profit hoy: <strong>{money.format(microProfit.netProfitToday)}</strong></span>
        <span>Average net win: <strong>{money.format(microProfit.averageNetWin)}</strong></span>
        <span>Average net loss: <strong>{money.format(microProfit.averageNetLoss)}</strong></span>
        <span>Cost/profit: <strong>{microProfit.costToProfitRatio.toFixed(2)}</strong></span>
        <span>Profit factor: <strong>{microProfit.profitFactor.toFixed(2)}</strong></span>
        <span>Expected payoff: <strong>{money.format(microProfit.expectedPayoff)}</strong></span>
      </div>
      {localTarget === 1 ? <p className="warning">Target $1 neto puede ser consumido por spread/slippage. Usar solo en demo.</p> : null}
    </section>
  )
}
