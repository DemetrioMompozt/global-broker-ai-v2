import type { DefensiveDiagnosticStatus } from '../../types/trading'
import { activateDefensiveDiagnostic, activateRecoveryProbe } from '../../api/client'

const money = new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency', maximumFractionDigits: 2 })

export function DefensiveDiagnosticMode({ diagnostic, onRefresh }: { diagnostic: DefensiveDiagnosticStatus; onRefresh: () => void }) {
  const isRecovery = diagnostic.mode === 'RECOVERY_PROBE_MODE'
  const tone = diagnostic.active ? 'loss' : 'gain'

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Defensive Diagnostic Mode</div>
          <h3 className={tone}>{isRecovery ? 'RECOVERY PROBE' : diagnostic.active ? 'ACTIVO' : 'INACTIVO'}</h3>
          <p className="muted">{diagnostic.reason}</p>
        </div>
        <div className="status-pill">{diagnostic.newEntriesBlocked ? 'Entradas bloqueadas' : 'Entradas permitidas'}</div>
      </div>
      <div className="position-metrics">
        <span>Nuevas entradas: <strong>{diagnostic.newEntriesBlocked ? 'bloqueadas' : 'permitidas'}</strong></span>
        <span>Riesgo nuevo: <strong>{money.format(diagnostic.newRiskUsd)}</strong></span>
        <span>Micro target: <strong>{diagnostic.microProfitSuspended ? 'suspendido' : 'activo'}</strong></span>
        <span>Reactivacion risk: <strong>{money.format(diagnostic.reactivationRiskUsd)}</strong></span>
        <span>Leverage reactivacion: <strong>{diagnostic.maxReactivationLeverage}x max</strong></span>
        <span>Posiciones reactivacion: <strong>{diagnostic.maxReactivationOpenPositions}</strong></span>
      </div>
      <div className="hero-actions">
        <button className={isRecovery ? 'active' : 'secondary'} onClick={() => void activateRecoveryProbe().then(onRefresh)}>Modo intermedio</button>
        <button className={diagnostic.active ? 'active' : 'secondary'} onClick={() => void activateDefensiveDiagnostic().then(onRefresh)}>Freno defensivo</button>
      </div>
      <p className={isRecovery ? 'reason' : 'warning'}>
        {isRecovery
          ? 'Punto medio: max 2 posiciones, risk $10, leverage maximo 10x y filtros mas exigentes. Si el margen entra en peligro, vuelve a diagnostico.'
          : 'Siguiente accion: gestionar posiciones abiertas y diagnosticar edge. No volver a operar agresivo sin revision.'}
      </p>
      <div className="tag-row">
        {diagnostic.states.map((state) => <span className="tag" key={state}>{state}</span>)}
      </div>
    </section>
  )
}
