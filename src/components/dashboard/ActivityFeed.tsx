import type { ActivityItem } from '../../types/trading'

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section className="panel">
      <div className="eyebrow">Activity Feed</div>
      <h3>Actividad del agente</h3>
      <div className="feed">
        {items.slice(0, 12).map((item, index) => (
          <div className="feed-item" key={`${item.time}-${item.action}-${item.symbol ?? ''}-${index}`}>
            <strong>{item.action}{item.symbol ? ` - ${item.symbol}` : ''}</strong>
            <span>{item.reason}</span>
            <small>{new Date(item.time).toLocaleTimeString()}</small>
          </div>
        ))}
      </div>
    </section>
  )
}
