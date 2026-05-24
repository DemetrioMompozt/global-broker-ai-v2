import type { LossPatternFirewallStatus } from '../../types/trading'

export function LossPatternFirewallPanel({ firewall }: { firewall: LossPatternFirewallStatus }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <span>LOSS PATTERN FIREWALL</span>
          <h2>{firewall.active ? 'Protegiendo main paper' : 'Normal'}</h2>
        </div>
        <strong className={firewall.active ? 'negative' : 'positive'}>{firewall.mode}</strong>
      </div>
      <p className="muted">{firewall.reason}</p>
      <div className="metric-grid">
        <span>Patron bloqueado: <strong>{firewall.blockedPattern ?? 'ninguno'}</strong></span>
        <span>Main paper: <strong>{firewall.mainPaperAllowed ? 'permitido' : 'bloqueado para ese patron'}</strong></span>
        <span>Learning shadow: <strong>{firewall.shadowLearningRecommended ? 'activo recomendado' : 'normal'}</strong></span>
        <span>Balance/margen: <strong>no toca shadow</strong></span>
      </div>
    </section>
  )
}
