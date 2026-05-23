import type { CfdPaperStatus } from '../../types/trading'
import { startAgent, stopAgent } from '../../api/client'

export function HeroAgentStatus({ status, onRefresh }: { status: CfdPaperStatus; onRefresh: () => void }) {
  const openCount = status.openPositions.length
  const vtOpenCount = status.openPositions.filter((position) => position.source === 'VT_MARKETS_MT5_DEMO').length
  const binanceOpenCount = status.openPositions.filter((position) => position.source === 'BINANCE_REALTIME' || position.assetClass === 'CRYPTO_CFD').length
  const vtConnected = status.sources?.vtMarkets.status === 'CONNECTED_DEMO_READ_ONLY' || status.vtMarkets.status === 'CONNECTED_DEMO_READ_ONLY'
  const diagnosticActive = status.defensiveDiagnostic?.active
  const workerRunning = status.agent.workerRunning
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
          {status.learningCampaign?.enabled ? <span className="badge badge-good">Learning: {status.learningCampaign.completedSamples}/{status.learningCampaign.targetSamples}</span> : null}
        </div>
        <p className="muted">
          Ultima evaluacion: {status.agent.lastEvaluationAt ? new Date(status.agent.lastEvaluationAt).toLocaleTimeString() : 'pendiente'} · Proxima: {status.agent.nextEvaluationAt ? new Date(status.agent.nextEvaluationAt).toLocaleTimeString() : 'pendiente'}
        </p>
      </div>
      <div className="hero-actions">
        <button disabled={workerRunning} onClick={() => void startAgent().then(onRefresh)}>{workerRunning ? 'Agente corriendo' : 'Iniciar agente paper'}</button>
        <button className="secondary" disabled={!workerRunning} onClick={() => void stopAgent().then(onRefresh)}>Detener</button>
      </div>
    </section>
  )
}
