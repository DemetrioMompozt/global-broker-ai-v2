import { useState } from 'react'
import { closePosition } from '../../api/client'
import type { CfdPosition } from '../../types/trading'

const money = new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency', maximumFractionDigits: 4 })
const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 })

export function OpenCfdPositions({
  maxPositions = 10,
  onClosed,
  positions,
}: {
  maxPositions?: number
  onClosed?: () => Promise<void> | void
  positions: CfdPosition[]
}) {
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [closeError, setCloseError] = useState<string | null>(null)
  const totalPnl = positions.reduce((sum, position) => sum + position.openPnl, 0)
  const vtCount = positions.filter((position) => position.source === 'VT_MARKETS_MT5_DEMO').length
  const binanceCount = positions.filter((position) => position.source === 'BINANCE_REALTIME' || position.assetClass === 'CRYPTO_CFD').length

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Posiciones CFD Paper Abiertas</div>
          <h3>{positions.length}/{maxPositions} posiciones abiertas</h3>
          <p className="muted">P/L abierto {money.format(totalPnl)} - VT Markets {vtCount} - Binance {binanceCount}. El riesgo se muestra por posicion, no agregado.</p>
        </div>
      </div>
      {positions.length === 0 ? <p className="muted">Sin posicion abierta. El agente sigue escaneando oportunidades CFD globales.</p> : null}
      <div className="position-grid">
        {positions.map((position) => (
          <article className="position-card" key={position.id}>
            <div className="position-title">
              <div>
                <strong>{position.cfdSymbol}</strong>
                <div className="muted">{position.direction} / {position.strategy} / {position.underlyingSymbol} / {position.source ?? position.provider}</div>
              </div>
              <div className="position-actions">
                <div className={position.openPnl >= 0 ? 'gain big' : 'loss big'}>{money.format(position.openPnl)}</div>
                <button
                  className="danger"
                  disabled={closingId === position.id}
                  onClick={() => {
                    setCloseError(null)
                    setConfirmCloseId(position.id)
                  }}
                  type="button"
                >
                  {closingId === position.id ? 'Cerrando...' : 'Cerrar paper'}
                </button>
              </div>
            </div>

            <div className="position-risk-strip">
              <span className="risk-tile primary">
                <small>Riesgo al stop</small>
                <strong>{money.format(position.riskUsd)}</strong>
                <em>{position.riskPercent.toFixed(3)}% equity</em>
              </span>
              <span className="risk-tile">
                <small>Target neto</small>
                <strong>{money.format(position.microTargetNetUsd ?? 2)}</strong>
                <em>{position.microTargetNetUsd ? (position.riskUsd / position.microTargetNetUsd).toFixed(2) : '-'}x riesgo/target</em>
              </span>
              <span className="risk-tile">
                <small>Movimiento para $2</small>
                <strong>{position.minimumMoveBps !== undefined ? `${position.minimumMoveBps.toFixed(2)} bps` : '-'}</strong>
                <em>{position.minimumMoveNeeded !== undefined ? num.format(position.minimumMoveNeeded) : 'pendiente'}</em>
              </span>
              <span className="risk-tile">
                <small>Tamano paper</small>
                <strong>{num.format(position.positionSize)}</strong>
                <em>margen {money.format(position.marginRequired)}</em>
              </span>
            </div>

            <div className="position-metrics">
              <span>Bid: {position.currentBid ? num.format(position.currentBid) : num.format(position.currentPrice)}</span>
              <span>Ask: {position.currentAsk ? num.format(position.currentAsk) : num.format(position.currentPrice)}</span>
              <span>Entrada: {num.format(position.entryPrice)}</span>
              <span>P/L %: {position.openPnlPercent.toFixed(4)}%</span>
              <span>Stop: {num.format(position.stopLoss)}</span>
              <span>Take profit: {num.format(position.takeProfit)}</span>
              <span>Spread entry: {num.format(position.spreadAtEntry)}</span>
              <span>Costos est.: {money.format(position.totalEstimatedCost ?? 0)}</span>
              <span>Margin usado: {money.format(position.marginRequired)}</span>
              <span>Leverage: {position.leverage}x</span>
              <span>Provider: {position.provider}</span>
              <span>Source: {position.source ?? '-'}</span>
              <span>Feed: {position.feedType}</span>
              <span>CFD score: {position.cfdExpertScore}</span>
              {position.professionalSkillScore !== undefined ? <span>Skill CFD: {position.professionalSkillScore}</span> : null}
              <span>Revisado: {new Date(position.lastPriceUpdate).toLocaleTimeString()}</span>
              {position.lastBrokerTickTime ? <span>Hora broker: {new Date(position.lastBrokerTickTime).toLocaleTimeString()}</span> : null}
            </div>
            <p className="reason">{position.professionalSkillReason ?? position.cfdExpertReason}</p>
            {confirmCloseId === position.id ? (
              <div className="manual-close-confirm">
                <span>Esto cierra solo la posicion paper interna. No envia orden real.</span>
                <button
                  className="danger"
                  disabled={closingId === position.id}
                  onClick={async () => {
                    setClosingId(position.id)
                    setCloseError(null)
                    try {
                      await closePosition(position.id)
                      setConfirmCloseId(null)
                      await onClosed?.()
                    } catch (error) {
                      setCloseError(error instanceof Error ? error.message : String(error))
                    } finally {
                      setClosingId(null)
                    }
                  }}
                  type="button"
                >
                  Confirmar cierre paper
                </button>
                <button className="secondary" disabled={closingId === position.id} onClick={() => setConfirmCloseId(null)} type="button">
                  Cancelar
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
      {closeError ? <p className="warning">{closeError}</p> : null}
    </section>
  )
}
