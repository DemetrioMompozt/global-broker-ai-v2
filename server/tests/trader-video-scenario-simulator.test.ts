import { runTraderVideoScenarioSimulation } from '../strategy/traderVideoScenarioSimulator.js'
import { assert, done } from './assert.js'

const simulation = runTraderVideoScenarioSimulation(new Date('2026-06-11T07:00:00.000Z'))

assert(simulation.mode === 'TRADER_VIDEO_SCENARIO_SIMULATOR', 'Debe construir simulador de escenarios canonicos.')
assert(simulation.totalScenarios === 5, 'Debe cubrir cinco escenarios base.')
assert(simulation.failedScenarios.length === 0, simulation.summary)
assert(simulation.passedScenarios === simulation.totalScenarios, 'Todos los escenarios canonicos deben pasar.')

const byId = Object.fromEntries(simulation.scenarios.map((scenario) => [scenario.id, scenario]))
assert(byId.BUYERS_TRAPPED_VALID_SHORT?.agentDecision === 'GOOD_ENTRY', 'Compradores atrapados + setup completo debe permitir short bueno.')
assert(byId.BUYERS_TRAPPED_VALID_SHORT?.canOpenTactically === true, 'Short completo debe poder pasar tacticamente.')
assert(byId.SELLERS_TRAPPED_VALID_LONG?.agentDecision === 'GOOD_ENTRY', 'Vendedores atrapados + setup completo debe permitir long bueno.')
assert(byId.SELLERS_TRAPPED_VALID_LONG?.canOpenTactically === true, 'Long completo debe poder pasar tacticamente.')
assert(byId.BREAKOUT_ACCEPTED_NO_TRADE?.agentDecision === 'NO_TRADE', 'Breakout aceptado no se debe fade/operar contra institucional.')
assert(byId.BREAKOUT_ACCEPTED_NO_TRADE?.canOpenTactically === false, 'Breakout aceptado no puede abrir.')
assert(byId.TWO_POINT_TRENDLINE_BLOCKED?.agentDecision === 'NO_TRADE', 'Trendline de dos puntos debe bloquear.')
assert(byId.TWO_POINT_TRENDLINE_BLOCKED?.tacticalBlockers.includes('BLOCKED_TRENDLINE_LOW_QUALITY'), 'Debe explicar trendline de baja calidad.')
assert(byId.RR_BELOW_2_BLOCKED?.agentDecision === 'NO_TRADE', 'R/R menor a 2 debe bloquear.')
assert(byId.RR_BELOW_2_BLOCKED?.tacticalBlockers.includes('BLOCKED_RR_BELOW_2'), 'Debe explicar R/R bajo.')

done('trader-video-scenario-simulator')
