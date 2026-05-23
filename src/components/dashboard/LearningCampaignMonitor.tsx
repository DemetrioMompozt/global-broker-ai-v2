import type { LearningCampaignStatus } from '../../types/trading'

const money = new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency' })

export function LearningCampaignMonitor({ campaign }: { campaign: LearningCampaignStatus }) {
  const isComplete = campaign.enabled && campaign.completedSamples >= campaign.targetSamples
  const status = isComplete ? 'COMPLETADA' : campaign.enabled ? 'ACTIVA' : 'APAGADA'
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <span>WEEKEND SHADOW LEARNING CAMPAIGN</span>
          <h2>Campana de aprendizaje</h2>
        </div>
        <strong className={campaign.enabled && !isComplete ? 'positive' : 'muted'}>{status}</strong>
      </div>
      <p className="muted">
        Recolecta muestras con feeds reales de VT/Binance para que el agente y GPT-5.5 aprendan sin tocar balance, margen ni ejecucion.
      </p>
      <div className="metric-grid">
        <span>Progreso: <strong>{Math.min(campaign.completedSamples, campaign.targetSamples)} / {campaign.targetSamples}</strong></span>
        <span>Abiertas shadow: <strong>{campaign.openSamples}</strong></span>
        <span>Restantes: <strong>{campaign.remainingSamples}</strong></span>
        <span>Target muestra: <strong>{money.format(campaign.targetNetUsd)}</strong></span>
        <span>Targets logrados: <strong>{campaign.targetHits}</strong></span>
        <span>Win rate shadow: <strong>{campaign.winRate.toFixed(1)}%</strong></span>
        <span>Net shadow: <strong className={campaign.netPnl >= 0 ? 'positive' : 'negative'}>{money.format(campaign.netPnl)}</strong></span>
        <span>Hold promedio: <strong>{campaign.averageHoldSeconds ? `${campaign.averageHoldSeconds.toFixed(0)}s` : '-'}</strong></span>
      </div>
      <p className="notice">{campaign.lastDecision}</p>
      <div className="pill-row">
        <span className="pill">shadowOnly=true</span>
        <span className="pill">no afecta balance</span>
        <span className="pill">no afecta margen</span>
        <span className="pill">order_send=false</span>
      </div>
      {campaign.recentSamples.length ? (
        <div className="mini-list">
          {campaign.recentSamples.slice(0, 5).map((sample, index) => (
            <span key={`${sample.cfdSymbol}-${index}`}>
              <strong>{sample.cfdSymbol}</strong> {sample.direction} · {sample.exitReason} · {money.format(sample.netPnl)}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  )
}
