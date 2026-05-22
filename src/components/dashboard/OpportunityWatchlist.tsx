import type { Opportunity } from '../../types/trading'

export function OpportunityWatchlist({ opportunities, blocked }: { opportunities: Opportunity[]; blocked: Array<{ cfdSymbol: string; reason: string }> }) {
  const groups = [
    { items: opportunities.filter((item) => item.source === 'VT_MARKETS_MT5_DEMO'), title: 'VT Markets CFD Opportunities' },
    { items: opportunities.filter((item) => item.source === 'BINANCE_REALTIME' || item.assetClass === 'CRYPTO_CFD'), title: 'Binance Crypto CFD Opportunities' },
  ]

  return (
    <section className="panel">
      <div className="eyebrow">Opportunity Watchlist</div>
      <h3>Oportunidades CFD</h3>
      {groups.map((group) => (
        <div className="table opportunity-group" key={group.title}>
          <h4>{group.title}</h4>
          <div className="row head"><span>CFD</span><span>Score</span><span>Estrategia</span><span>Setup</span><span>Feed</span><span>Decision</span></div>
          {group.items.slice(0, 8).map((item) => (
            <div className="row" key={item.cfdSymbol}>
              <span>{item.cfdSymbol}<small>{item.underlyingSymbol} / {item.source}</small></span>
              <span>{(item.learningAdjustedScore ?? item.cfdExpertScore ?? item.score).toFixed(0)}<small>base {(item.cfdExpertScore ?? item.score).toFixed(0)} / bias {item.learningBias?.toFixed(1) ?? '0.0'}</small></span>
              <span>{item.strategy}</span>
              <span>{item.setupStatus}<small>{item.candlePattern ?? 'vela pendiente'} {item.candleBehaviorScore ? `(${item.candleBehaviorScore.toFixed(0)})` : ''}</small></span>
              <span>{item.provider} / {item.feedType}<small>spread {item.spreadBps?.toFixed(2) ?? '-'} bps</small></span>
              <span>{item.decision ?? item.cfdExpertDecision}<small>{item.learningReason ?? item.reason}</small></span>
            </div>
          ))}
          {!group.items.length ? <p className="muted">Sin oportunidades activas en este grupo por ahora.</p> : null}
        </div>
      ))}
      {blocked.length ? <div className="blocked-list">{blocked.slice(0, 8).map((item) => <p key={item.cfdSymbol}><strong>{item.cfdSymbol}</strong>: {item.reason}</p>)}</div> : null}
    </section>
  )
}
