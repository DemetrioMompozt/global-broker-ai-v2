import type { MarketNewsStatus } from '../../types/trading'

export function MarketNewsIntelligence({ news }: { news: MarketNewsStatus }) {
  const top = news.topEvents.slice(0, 5)
  return (
    <section className="panel">
      <div className="panel-title">MARKET NEWS INTELLIGENCE</div>
      <div className={`status-${news.globalRisk.toLowerCase()}`}>
        Noticias: {news.status} · Riesgo macro: {news.globalRisk}
      </div>
      <p className="muted">{news.summary}</p>
      <div className="metric-grid">
        <div className="metric">Ultima lectura: <strong>{news.lastUpdatedAt ? new Date(news.lastUpdatedAt).toLocaleTimeString() : 'pendiente'}</strong></div>
        <div className="metric">Proxima lectura: <strong>{news.nextUpdateAt ? new Date(news.nextUpdateAt).toLocaleTimeString() : 'pendiente'}</strong></div>
        <div className="metric">Fuentes OK: <strong>{news.sources.filter((source) => source.status === 'OK').length}/{news.sources.length}</strong></div>
        <div className="metric">Eventos vigilados: <strong>{news.topEvents.length}</strong></div>
      </div>
      {top.length ? (
        <div className="news-list">
          {top.map((event) => (
            <a className="news-item" href={event.url} key={`${event.title}-${event.publishedAt}`} rel="noreferrer" target="_blank">
              <span className={`news-impact ${event.impact.toLowerCase()}`}>{event.impact}</span>
              <strong>{event.title}</strong>
              <small>{event.source} · {new Date(event.publishedAt).toLocaleString()} · {event.affectedMarkets.join(', ') || 'general'}</small>
            </a>
          ))}
        </div>
      ) : <p className="muted">Sin titulares relevantes en la ultima lectura.</p>}
    </section>
  )
}
