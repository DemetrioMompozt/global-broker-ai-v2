export function MetricCard({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail?: string; tone?: 'good' | 'bad' | 'neutral' | 'warn' }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className={`metric-value metric-${tone}`}>{value}</div>
      {detail ? <div className="metric-detail">{detail}</div> : null}
    </div>
  )
}
