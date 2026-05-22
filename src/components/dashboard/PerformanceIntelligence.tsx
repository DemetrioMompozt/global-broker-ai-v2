import type { CfdPaperStatus } from '../../types/trading'
import { MetricCard } from '../shared/MetricCard'

export function PerformanceIntelligence({ performance }: { performance: CfdPaperStatus['performance'] }) {
  return (
    <section className="grid cards-4">
      <MetricCard label="Profit Factor" value={performance.profitFactorDisplay ?? performance.profitFactor.toFixed(2)} detail={performance.sampleSizeReason} tone={performance.sampleSizeStatus === 'INSUFFICIENT_SAMPLE' ? 'warn' : 'neutral'} />
      <MetricCard label="Win Rate" value={`${performance.winRate.toFixed(1)}%`} />
      <MetricCard label="Net Profit" value={`$${performance.netProfit.toFixed(2)}`} tone={performance.netProfit >= 0 ? 'good' : 'bad'} />
      <MetricCard label="Expected Payoff" value={`$${performance.expectedPayoff.toFixed(2)}`} />
    </section>
  )
}
