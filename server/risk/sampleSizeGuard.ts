import { getClosedTrades } from '../storage/tradeStore.js'

export function evaluateSampleSize() {
  const closedTrades = getClosedTrades().length
  const insufficientSample = closedTrades < 20
  return {
    closedTrades,
    displayProfitFactorAs: insufficientSample ? 'N/A - muestra insuficiente' : null,
    insufficientSample,
    minForMicroMode: 30,
    minForFivePositions: 50,
    minForRiskIncrease: 100,
    reason: insufficientSample ? 'Profit factor no concluyente: muestra insuficiente.' : 'Muestra suficiente para evaluar metricas basicas.',
  }
}
