import type { NoPositionWatchdogStatus, ProfessionalAuditStatus } from '../../types/trading'

function badgeClass(status: string) {
  if (status === 'PASS') return 'badge-good'
  if (status === 'WATCH') return 'badge-warn'
  return 'badge-bad'
}

export function ProfessionalSystemAudit({ audit, watchdog }: { audit: ProfessionalAuditStatus; watchdog: NoPositionWatchdogStatus }) {
  const tone = audit.grade === 'PROFESSIONAL_READY'
    ? 'gain'
    : audit.grade === 'BLOCKED'
      ? 'loss'
      : 'metric-warn'

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Professional Operations Audit</div>
          <h3 className={tone}>{audit.headline}</h3>
          <p className="muted">{audit.nextAction}</p>
        </div>
        <div className="big">Score {audit.score}</div>
      </div>
      {audit.rootCause ? <div className="notice">Causa principal: <strong>{audit.rootCause}</strong></div> : null}
      <div className={watchdog.active ? 'notice watchdog-active' : 'notice'}>
        Watchdog de actividad: <strong>{watchdog.status}</strong> · {watchdog.reason}
        {watchdog.candidateSymbol ? <> Candidato: <strong>{watchdog.candidateSymbol}</strong>.</> : null}
      </div>
      <div className="audit-grid">
        {audit.checks.map((item) => (
          <div className="audit-tile" key={item.id}>
            <span className={`badge ${badgeClass(item.status)}`}>{item.status}</span>
            <strong>{item.label}</strong>
            <small>{item.message}</small>
          </div>
        ))}
      </div>
      {audit.automaticActions.length ? (
        <div className="mini-list">
          {audit.automaticActions.map((action) => <span key={action}>{action}</span>)}
        </div>
      ) : null}
    </section>
  )
}
