import type { CfdPaperStatus } from '../../types/trading'

export function HeroAgentStatus({ status }: { status: CfdPaperStatus }) {
  const openCount = status.openPositions.length
  const vtOpenCount = status.openPositions.filter((position) => position.source === 'VT_MARKETS_MT5_DEMO').length
  const binanceOpenCount = status.openPositions.filter((position) => position.source === 'BINANCE_REALTIME' || position.assetClass === 'CRYPTO_CFD').length
  const vtConnected = status.sources?.vtMarkets.status === 'CONNECTED_DEMO_READ_ONLY' || status.vtMarkets.status === 'CONNECTED_DEMO_READ_ONLY'
  const diagnosticActive = status.defensiveDiagnostic?.active
  const workerRunning = status.agent.workerRunning
  const campaignDone = status.learningCampaign?.enabled && status.learningCampaign.completedSamples >= status.learningCampaign.targetSamples
  const lastDecision = typeof status.agent.lastDecision?.decision === 'string' ? status.agent.lastDecision.decision : ''
  const lastDecisionReason = typeof status.agent.lastDecision?.reason === 'string' ? status.agent.lastDecision.reason : ''
  const title = diagnosticActive ? 'Modo diagnostico defensivo' : openCount > 0 ? 'Gestionando posiciones CFD paper' : 'Buscando oportunidades CFD'
  const subtitle = diagnosticActive
    ? 'Nuevas entradas bloqueadas. El agente gestiona posiciones abiertas y analiza por que el sistema esta perdiendo.'
    : openCount > 0
      ? vtConnected
        ? `El agente mantiene ${openCount} posicion(es) paper: ${vtOpenCount} via VT Markets MT5 Demo como feed CFD principal y ${binanceOpenCount} via Binance como cripto complementario.`
        : `El agente mantiene ${openCount} posicion(es) paper y sigue buscando oportunidades CFD. VT Markets aun no esta conectado.`
      : vtConnected
        ? 'El agente usa VT Markets MT5 Demo como feed CFD principal y Binance solo como complemento cripto paper.'
        : 'El agente escanea oportunidades, valida setup, costos, margen y guardianes antes de abrir paper trades.'

  return (
    <section className="hero">
      <div>
        <div className="eyebrow">{status.mode}</div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
        <div className="tag-row">
          <span className={workerRunning ? 'badge badge-good' : 'badge badge-bad'}>Agente: {workerRunning ? 'corriendo' : 'detenido'}</span>
          <span className="badge badge-neutral">Estado: {status.agent.status}</span>
          {status.learningCampaign?.enabled ? <span className={campaignDone ? 'badge badge-neutral' : 'badge badge-good'}>Learning: {status.learningCampaign.completedSamples}/{status.learningCampaign.targetSamples}</span> : null}
        </div>
        {workerRunning && lastDecisionReason ? (
          <p className="notice">
            {lastDecision}: {lastDecisionReason}
          </p>
        ) : null}
        <p className="muted">
          Ultima evaluacion: {status.agent.lastEvaluationAt ? new Date(status.agent.lastEvaluationAt).toLocaleTimeString() : 'pendiente'} · Proxima: {status.agent.nextEvaluationAt ? new Date(status.agent.nextEvaluationAt).toLocaleTimeString() : 'pendiente'}
        </p>
      </div>
      <div className="auto-status-card">
        <span>Operacion automatica</span>
        <strong>{workerRunning ? 'Activa 24/7' : 'Reanudando'}</strong>
        <small>El agente arranca y se mantiene desde el servidor.</small>
      </div>
    </section>
  )
}
