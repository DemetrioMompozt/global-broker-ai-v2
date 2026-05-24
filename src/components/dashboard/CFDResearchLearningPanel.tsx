import type { CfdResearchLearningStatus } from '../../types/trading'

function tone(status: CfdResearchLearningStatus['status']) {
  if (status === 'READY') return 'gain'
  if (status === 'ERROR' || status === 'NOT_CONFIGURED' || status === 'QUOTA_EXCEEDED') return 'loss'
  return ''
}

function label(status: CfdResearchLearningStatus['status']) {
  if (status === 'NOT_CONFIGURED') return 'GPT-5.5 no configurado'
  if (status === 'DISABLED') return 'Desactivado'
  if (status === 'RUNNING') return 'Investigando'
  if (status === 'READY') return 'Aprendizaje listo'
  if (status === 'QUOTA_EXCEEDED') return 'GPT pausado por cuota'
  if (status === 'ERROR') return 'Error de investigacion'
  return 'En espera'
}

const fallbackLearning: CfdResearchLearningStatus = {
  enabled: true,
  configured: false,
  model: 'gpt-5.5',
  webSearchEnabled: true,
  status: 'NOT_CONFIGURED',
  lastRunAt: null,
  nextRunAt: null,
  pausedUntil: null,
  trigger: null,
  summary: 'El API aun no devolvio el estado de GPT-5.5 research learning. Reinicia el servidor o espera el siguiente refresh.',
  techniquesResearched: [],
  hypotheses: [],
  candleLessons: [],
  ruleProposals: [],
  riskWarnings: [],
  nextExperiment: 'Verificar OPENAI_API_KEY y reiniciar el servidor de produccion.',
  operationalPolicy: 'Research only: propone hipotesis; no abre, no cierra y no envia ordenes.',
  safety: {
    paperOnly: true,
    canOpenTrades: false,
    canCloseTrades: false,
    canSendOrders: false,
    realTradingAllowed: false,
    brokerExecutionEnabled: false,
  },
}

export function CFDResearchLearningPanel({ learning: incomingLearning }: { learning?: CfdResearchLearningStatus }) {
  const learning = incomingLearning ?? fallbackLearning

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">GPT-5.5 CFD Research Learning Agent</div>
          <h3 className={tone(learning.status)}>{label(learning.status)}</h3>
          <p className="muted">{learning.summary}</p>
        </div>
        <div className="auto-status-card">
          <span>Investigacion automatica</span>
          <strong>{learning.status === 'RUNNING' ? 'En curso' : learning.status === 'QUOTA_EXCEEDED' ? 'Pausada' : learning.configured ? 'Programada' : 'Pendiente'}</strong>
          <small>GPT-5.5 revisa por intervalo; no opera ni envia ordenes.</small>
        </div>
      </div>
      <div className="position-metrics">
        <span>Modelo: <strong>{learning.model}</strong></span>
        <span>Web search: <strong>{learning.webSearchEnabled ? 'activo' : 'apagado'}</strong></span>
        <span>Ultima revision: <strong>{learning.lastRunAt ? new Date(learning.lastRunAt).toLocaleTimeString() : 'pendiente'}</strong></span>
        <span>Pausa: <strong>{learning.pausedUntil ? `hasta ${new Date(learning.pausedUntil).toLocaleTimeString()}` : 'no'}</strong></span>
        <span>Permiso operativo: <strong>research only</strong></span>
      </div>
      {!learning.configured ? (
        <p className="warning">Falta OPENAI_API_KEY en el servidor. GPT-5.5 no se ejecuta hasta configurarlo; la app sigue con aprendizaje local y paper safe.</p>
      ) : null}
      {learning.error ? <p className="warning">{learning.error}</p> : null}
      {learning.status === 'QUOTA_EXCEEDED' ? (
        <p className="warning">OpenAI no tiene cuota disponible. GPT Research queda pausado; el agente sigue paper/demo con aprendizaje local, biblioteca profesional, velas y safety guards.</p>
      ) : null}
      <div className="two-column">
        <div className="subpanel">
          <div className="eyebrow">Hipotesis y velas</div>
          {learning.hypotheses.slice(0, 5).map((item) => <p className="muted" key={item}>{item}</p>)}
          {learning.candleLessons.slice(0, 5).map((item) => <p className="reason" key={item}>{item}</p>)}
          {!learning.hypotheses.length && !learning.candleLessons.length ? <p className="muted">Aun no hay investigacion GPT ejecutada.</p> : null}
        </div>
        <div className="subpanel">
          <div className="eyebrow">Reglas propuestas</div>
          {learning.ruleProposals.slice(0, 5).map((rule) => (
            <p className="reason" key={`${rule.proposedRule}-${rule.evidence}`}>
              <strong>{rule.confidence}</strong>: {rule.proposedRule}<br />
              <small>{rule.reason} Validacion: {rule.validationPlan}</small>
            </p>
          ))}
          {!learning.ruleProposals.length ? <p className="muted">{learning.nextExperiment}</p> : null}
        </div>
      </div>
      <div className="tag-row">
        <span className="tag">paperOnly=true</span>
        <span className="tag">no abre trades</span>
        <span className="tag">no cierra trades</span>
        <span className="tag">order_send=false</span>
      </div>
    </section>
  )
}
