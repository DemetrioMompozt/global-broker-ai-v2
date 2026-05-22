import type { AdaptiveLearningStatus } from '../../types/trading'

const money = new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency', maximumFractionDigits: 4 })

export function AgentLearningPanel({ learning }: { learning: AdaptiveLearningStatus }) {
  const tone = learning.status === 'READY_TO_TEST'
    ? 'gain'
    : learning.status === 'PROTECTING'
      ? 'loss'
      : ''

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Agent Learning Loop</div>
          <h3 className={tone}>{learning.status}</h3>
          <p className="muted">{learning.mainLesson}</p>
        </div>
        <div className="big">Learning {learning.learningScore}</div>
      </div>
      <div className="position-metrics">
        <span>Muestra hoy: <strong>{learning.sampleSize}</strong></span>
        <span>Net P/L aprendido: <strong>{money.format(learning.netPnlToday)}</strong></span>
        <span>Problema principal: <strong>{learning.mainProblem}</strong></span>
        <span>Siguiente experimento: <strong>{learning.nextExperiment}</strong></span>
      </div>
      <div className="two-column">
        <div className="subpanel">
          <div className="eyebrow">Buenas entradas aprendidas</div>
          {learning.winningPatterns.length ? learning.winningPatterns.slice(0, 5).map((pattern) => (
            <div className="compact-row" key={pattern.key}>
              <strong>{pattern.symbol}</strong>
              <span>{pattern.direction} / {pattern.strategy}</span>
              <span>{pattern.candlePattern ?? 'vela N/A'}</span>
              <span>+{pattern.scoreBoost.toFixed(1)}</span>
              <small>{pattern.whyItWorked}</small>
            </div>
          )) : <p className="muted">Aun no hay suficientes cierres ganadores para formar un playbook.</p>}
        </div>
        <div className="subpanel">
          <div className="eyebrow">Reglas y soluciones</div>
          {learning.rules.slice(0, 5).map((rule) => (
            <p className="reason" key={rule.id}><strong>{rule.action}</strong>: {rule.solution}</p>
          ))}
          {learning.solutions.slice(0, 4).map((solution) => <p className="muted" key={solution}>{solution}</p>)}
        </div>
      </div>
    </section>
  )
}
