import type { CfdPaperStatus } from '../../types/trading'
import { MetricCard } from '../shared/MetricCard'

const money = new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency', maximumFractionDigits: 2 })

export function AccountSummary({ account }: { account: CfdPaperStatus['account'] }) {
  const profitPct = account.balance > 0 ? (account.equity / 2500 - 1) * 100 : 0
  return (
    <section className="grid cards-4">
      <MetricCard label="Balance" value={money.format(account.balance)} detail={`Closed P/L ${money.format(account.closedPnl)}`} />
      <MetricCard label="Equity" value={money.format(account.equity)} detail={`Open P/L ${money.format(account.openPnl)}`} tone={account.openPnl >= 0 ? 'good' : 'bad'} />
      <MetricCard label="Profit %" value={`${profitPct.toFixed(2)}%`} detail="Balance + open P/L" tone={profitPct >= 0 ? 'good' : 'bad'} />
      <MetricCard label="Margin" value={`${account.marginLevel.toFixed(0)}%`} detail={`Used ${money.format(account.usedMargin)} / Free ${money.format(account.freeMargin)}`} tone={account.marginLevel > 250 ? 'good' : 'warn'} />
    </section>
  )
}
