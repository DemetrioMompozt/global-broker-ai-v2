import assert from 'node:assert'
import { getSafetyConfig } from '../config/safetyConfig.js'
import { activateDefensiveDiagnosticMode, activateRecoveryProbeMode, getDefensiveDiagnosticMode } from '../risk/defensiveDiagnosticMode.js'

activateRecoveryProbeMode()
let diagnostic = getDefensiveDiagnosticMode({
  balance: 2500,
  equity: 2500,
  freeMargin: 1800,
  marginLevel: 350,
  openPnl: 0,
  portfolioLeverage: 0,
  usedMargin: 700,
})

assert.strictEqual(diagnostic.mode, 'RECOVERY_PROBE_MODE', 'Por defecto debe quedar un punto medio, no modo agresivo.')
assert.strictEqual(diagnostic.newEntriesBlocked, false, 'Recovery probe permite entradas limitadas.')
assert.strictEqual(diagnostic.newRiskUsd, 10, 'Recovery probe mantiene riesgo por posicion en $10.')
assert.strictEqual(diagnostic.reactivationRiskUsd, 10, 'No debe bajar el riesgo a $2.')
assert.strictEqual(diagnostic.maxReactivationLeverage, 25, 'Recovery probe usa leverage paper 25x para eficiencia de margen sin subir riskUsd.')
assert.strictEqual(diagnostic.maxReactivationOpenPositions, 6, 'Recovery probe permite varias posiciones controladas para medir edge.')

activateDefensiveDiagnosticMode()
diagnostic = getDefensiveDiagnosticMode({
  balance: 2500,
  equity: 2500,
  freeMargin: 1800,
  marginLevel: 350,
  openPnl: 0,
  portfolioLeverage: 0,
  usedMargin: 700,
})

assert.strictEqual(diagnostic.active, true, 'Manual override debe activar DEFENSIVE_DIAGNOSTIC_MODE.')
assert.strictEqual(diagnostic.newEntriesBlocked, true, 'Modo diagnostico bloquea nuevas entradas.')
assert.strictEqual(diagnostic.newRiskUsd, 0, 'Riesgo nuevo debe quedar en 0 mientras diagnostico esta activo.')
assert.strictEqual(diagnostic.microProfitSuspended, true, 'Micro profit queda suspendido.')
assert.strictEqual(diagnostic.reactivationRiskUsd, 10, 'Reactivacion mantiene riskUsd $10 segun preferencia del usuario.')
assert(diagnostic.maxReactivationLeverage <= 10, 'Leverage de reactivacion debe ser maximo 10x.')
assert.strictEqual(diagnostic.maxReactivationOpenPositions, 1, 'Reactivacion debe volver con una posicion de prueba.')

const safety = getSafetyConfig()
assert.strictEqual(safety.realTradingAllowed, false)
assert.strictEqual(safety.brokerExecutionEnabled, false)

console.log('test:defensive-diagnostic OK')
