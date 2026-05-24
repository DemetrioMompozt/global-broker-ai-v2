import type { ProfessionalTradingLibrarySkillStatus } from '../../types/trading'

export function ProfessionalTradingLibraryPanel({ library }: { library: ProfessionalTradingLibrarySkillStatus }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Professional Trading Library Skill</div>
          <h3>10 libros cargados siempre</h3>
          <p className="muted">{library.copyrightPolicy}</p>
        </div>
        <span className="pill good">{library.mode}</span>
      </div>
      <div className="position-metrics">
        <span>Libros activos: <strong>{library.booksLoaded}</strong></span>
        <span>Impacto: <strong>gate operativo</strong><small>afecta entradas main paper</small></span>
        <span>Velas: <strong>{library.candleBehaviorRules.length} reglas</strong></span>
        <span>Riesgo CFD: <strong>{library.riskRules.length} reglas</strong></span>
      </div>
      <div className="two-column">
        <div className="subpanel">
          <div className="eyebrow">Reglas que ya operan</div>
          {library.corePrinciples.slice(0, 4).map((item) => <p className="reason" key={item}>{item}</p>)}
          {library.candleBehaviorRules.slice(0, 3).map((item) => <p className="muted" key={item}>{item}</p>)}
        </div>
        <div className="subpanel">
          <div className="eyebrow">Biblioteca fuente</div>
          <div className="book-list">
            {library.researchSources.map((book) => (
              <a href={book.sourceUrl} key={book.title} rel="noreferrer" target="_blank">
                <strong>{book.title}</strong>
                <small>{book.author} - {book.focus}</small>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="tag-row">
        {library.operationalImpact.map((item) => <span className="tag" key={item}>{item}</span>)}
      </div>
    </section>
  )
}
