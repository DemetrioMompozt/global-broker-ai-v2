import type { CfdExpertEvaluation } from '../../types/trading'

export function CFDExpertPanel({ evaluation }: { evaluation: CfdExpertEvaluation | null }) {
  return (
    <section className="panel">
      <div className="eyebrow">CFD Expert Panel</div>
      <h3>{evaluation ? `${evaluation.decision} · ${evaluation.cfdSymbol}` : 'Esperando evaluacion CFD'}</h3>
      {evaluation ? (
        <>
          <div className="expert-grid">
            <span>Score: <strong>{evaluation.expertScore}</strong></span>
            <span>Riesgo: <strong>{evaluation.riskLevel}</strong></span>
            <span>Pricing: <strong>{evaluation.pricingQuality}</strong></span>
            <span>Spread: <strong>{evaluation.spreadAssessment}</strong></span>
            <span>Margin: <strong>{evaluation.marginAssessment}</strong></span>
            <span>Leverage: <strong>{evaluation.leverageAssessment}</strong></span>
          </div>
          <p className="reason">{evaluation.reason}</p>
        </>
      ) : <p className="muted">Todas las entradas CFD pasan por el experto antes de abrirse.</p>}
    </section>
  )
}
