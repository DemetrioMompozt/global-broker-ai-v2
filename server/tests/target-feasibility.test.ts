import assert from 'node:assert'
import { buildTargetFeasibility } from '../performance/targetFeasibilityAnalyzer.js'

const feasibility = buildTargetFeasibility()

assert.strictEqual(feasibility.targetNetUsd, 2, 'El analizador debe evaluar target neto $2.')
assert(typeof feasibility.verdict === 'string', 'Debe devolver un verdict accionable.')
assert(typeof feasibility.viable === 'boolean', 'Debe indicar si el target es viable.')
assert(feasibility.avgCostToProfitRatio >= 0, 'Debe medir costo/target.')

console.log('test:target-feasibility OK')
