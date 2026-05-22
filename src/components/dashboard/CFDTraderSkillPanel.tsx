import type { CfdTraderSkillStatus, TraderSkillAction } from '../../types/trading'

const money = new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency', maximumFractionDigits: 2 })

function ActionList({ empty, items, title }: { empty: string; items: TraderSkillAction[]; title: string }) {
  return (
    <div className="feed">
      <strong>{title}</strong>
      {items.length ? items.map((item) => (
        <div className="feed-item" key={`${title}-${item.type}-${item.symbol ?? ''}-${item.reason}`}>
          <strong>{item.type}{item.symbol ? ` - ${item.symbol}` : ''}</strong>
          <span>{item.reason}</span>
        </div>
      )) : <p className="muted">{empty}</p>}
    </div>
  )
}

export function CFDTraderSkillPanel({ skill }: { skill: CfdTraderSkillStatus }) {
  const tone = skill.mode === 'HUNTING'
    ? 'gain'
    : skill.mode === 'ROTATING'
      ? 'warning'
      : skill.mode === 'DEFENSIVE'
        ? 'loss'
        : ''

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">CFD Trader Skill</div>
          <h3 className={tone}>{skill.mode} / {skill.confidence}</h3>
          <p className="reason">{skill.reading ?? skill.headline}</p>
        </div>
        <span className={skill.actionsTaken.length ? 'pill good' : 'pill'}>{skill.actionsTaken.length ? 'Accion ejecutada' : 'Observando - sin accion todavia'}</span>
      </div>
      <div className="position-metrics">
        <span>Lectura: <strong>{skill.thesis}</strong></span>
        <span>Jugada sorpresa: <strong>{skill.surprisePlay ?? skill.surpriseMove}</strong></span>
        <span>Riesgo vigilado: <strong>{skill.riskWatched ?? 'sin riesgo especifico'}</strong></span>
        <span>Riesgo: <strong>{skill.riskWarning}</strong></span>
        <span>Cambia de opinion si: <strong>{skill.changeOfMindTrigger ?? skill.whatWouldChangeMind}</strong></span>
      </div>
      <div className="position-metrics">
        <span>
          Mejor oportunidad: <strong>{skill.strongestOpportunity?.cfdSymbol ?? '-'}</strong>
          <small>{skill.strongestOpportunity ? `score ${skill.strongestOpportunity.score.toFixed(0)} / net ${money.format(skill.strongestOpportunity.expectedNetProfit)} / spread ${skill.strongestOpportunity.spreadBps.toFixed(2)} bps` : 'sin entrada fresca'}</small>
        </span>
        <span>
          Posicion incomoda: <strong>{skill.weakestPosition?.cfdSymbol ?? '-'}</strong>
          <small>{skill.weakestPosition ? `P/L ${money.format(skill.weakestPosition.openPnl)} / ${skill.weakestPosition.ageMinutes.toFixed(1)}m / ${skill.weakestPosition.reason}` : 'sin posicion debil'}</small>
        </span>
      </div>
      <div className="feed">
        {skill.tacticalPlan.map((item) => (
          <div className="feed-item" key={item}>
            <strong>Plan</strong>
            <span>{item}</span>
          </div>
        ))}
      </div>
      <div className="grid cards-3">
        <ActionList empty="Sin sugerencias nuevas." items={skill.suggestedActions} title="Acciones sugeridas" />
        <ActionList empty="Sin acciones ejecutadas." items={skill.actionsTaken} title="Acciones tomadas" />
        <ActionList empty="Sin bloqueos del skill." items={skill.blockedActions} title="Acciones bloqueadas" />
      </div>
    </section>
  )
}
