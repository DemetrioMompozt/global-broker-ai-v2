import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { getSafetyConfig } from '../config/safetyConfig.js'
import { getMicroProfitCostLimits, getMicroProfitTargetNetUsd, microProfitConfig, setMicroProfitTargetNetUsd } from '../config/microProfitConfig.js'
import { calculateMicroProfitCosts, shouldCloseForMicroTarget, validateMicroProfitCosts } from '../cfd/microProfitEngine.js'

assert.strictEqual(getMicroProfitTargetNetUsd(), 2, 'Target por defecto debe ser 2.00.')
assert.strictEqual(microProfitConfig.maxLossPerTradeUsd, 10, 'Riesgo maximo por posicion paper debe ser $10.00.')

for (const target of [1, 2, 3]) {
  assert.strictEqual(setMicroProfitTargetNetUsd(target), target, `Target configurable debe aceptar ${target}.`)
}

setMicroProfitTargetNetUsd(2)
const costs = calculateMicroProfitCosts({ positionSize: 1, spread: 0.2, slippageEstimate: 0.1, targetNetUsd: 2 })
assert(shouldCloseForMicroTarget({ grossPnl: 2.3, costs, targetNetUsd: 2 }).close, 'Debe cerrar cuando netPnl >= target.')
assert(!shouldCloseForMicroTarget({ grossPnl: 2.1, costs, targetNetUsd: 2 }).close, 'No debe cerrar por grossPnl si netPnl no alcanza target.')

assert.strictEqual(getMicroProfitCostLimits(2).maxSpreadCostUsd, 0.4, 'Target $2 debe permitir spreadCost max $0.40.')
assert.strictEqual(getMicroProfitCostLimits(2).maxTotalEstimatedCostUsd, 0.6, 'Target $2 debe permitir costo total max $0.60.')
assert.strictEqual(getMicroProfitCostLimits(3).maxSpreadCostUsd, 0.6, 'Target $3 debe permitir spreadCost max $0.60.')
assert.strictEqual(getMicroProfitCostLimits(3).maxTotalEstimatedCostUsd, 0.9, 'Target $3 debe permitir costo total max $0.90.')

const expensiveForTwo = validateMicroProfitCosts({
  costs: { commission: 0, costToProfitRatio: 0.31, slippageEstimate: 0.1, spreadCost: 0.31, swapAccrued: 0, totalEstimatedCost: 0.61 },
  expectedNetProfit: 2,
  targetNetUsd: 2,
})
assert(!expensiveForTwo.approved, 'Para target $2 debe bloquear si totalEstimatedCost > $0.60.')

const expensiveForThree = validateMicroProfitCosts({
  costs: { commission: 0, costToProfitRatio: 0.31, slippageEstimate: 0.1, spreadCost: 0.5, swapAccrued: 0, totalEstimatedCost: 0.91 },
  expectedNetProfit: 3,
  targetNetUsd: 3,
})
assert(!expensiveForThree.approved, 'Para target $3 debe bloquear si totalEstimatedCost > $0.90.')

const safety = getSafetyConfig()
assert.strictEqual(safety.realTradingAllowed, false, 'realTradingAllowed debe seguir false.')
assert.strictEqual(safety.brokerExecutionEnabled, false, 'brokerExecutionEnabled debe seguir false.')

const appSource = readFileSync(new URL('../app.ts', import.meta.url), 'utf8')
assert(!appSource.includes('order_send'), 'No debe existir order_send activo en la app.')

console.log('test:micro-profit OK')
