import type { CfdPaperStatus } from '../../types/trading'
import { StatusPill } from '../shared/StatusPill'

export function RealtimeReadiness({ feeds }: { feeds: CfdPaperStatus['feeds'] }) {
  return (
    <section className="panel">
      <div className="eyebrow">Realtime Readiness</div>
      <h3>Feeds vivos</h3>
      <div className="readiness">
        <StatusPill label={`Binance ${feeds.binance.status}`} ok={feeds.binance.status === 'CONNECTED'} />
        <StatusPill label={`Alpaca ${feeds.alpaca.status}`} ok={feeds.alpaca.status === 'CONNECTED'} />
        <StatusPill label={`Finnhub ${feeds.finnhub.status}`} ok={feeds.finnhub.status === 'CONNECTED'} />
      </div>
      <p className="muted">Cripto CFD usa Binance REALTIME_TICK. Scalping real sigue bloqueado.</p>
    </section>
  )
}
