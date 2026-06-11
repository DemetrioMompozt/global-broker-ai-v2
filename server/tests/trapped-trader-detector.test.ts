import { detectTrappedTraders, type ProfessionalOpeningBar, type ProfessionalOpeningLevels } from '../strategy/trappedTraderDetector.js'
import { assert, done } from './assert.js'

const levels: ProfessionalOpeningLevels = {
  openingRangeHigh: 5010,
  openingRangeLow: 4995,
  overnightHigh: 5012,
  overnightLow: 4980,
  previousDayClose: 5001,
  previousDayHigh: 5011,
  previousDayLow: 4960,
  sessionHigh: 5014,
  sessionLow: 4988,
}

const bullTrapBars: ProfessionalOpeningBar[] = [
  { close: 5012, high: 5014, low: 5007, open: 5008, timestamp: '2026-06-05T13:45:00.000Z', volume: 1800 },
  { close: 5006, high: 5013, low: 5005, open: 5012, timestamp: '2026-06-05T13:46:00.000Z', volume: 2100 },
  { close: 4996, high: 5007, low: 4994, open: 5006, timestamp: '2026-06-05T13:47:00.000Z', volume: 2600 },
]

let trap = detectTrappedTraders({ bars: bullTrapBars, levels })
assert(trap.trapType === 'BULL_TRAP', 'Debe detectar bull trap al romper arriba y fallar.')
assert(trap.trappedSide === 'BUYERS', 'Bull trap atrapa compradores.')
assert(trap.failedLevel !== null, 'Debe registrar nivel fallido.')
assert(trap.confidence > 50, 'La trampa debe tener confianza operable.')

const bearTrapBars: ProfessionalOpeningBar[] = [
  { close: 4990, high: 4997, low: 4978, open: 4996, timestamp: '2026-06-05T13:45:00.000Z', volume: 1700 },
  { close: 5001, high: 5003, low: 4985, open: 4990, timestamp: '2026-06-05T13:46:00.000Z', volume: 2200 },
  { close: 5009, high: 5010, low: 4998, open: 5001, timestamp: '2026-06-05T13:47:00.000Z', volume: 2500 },
]
trap = detectTrappedTraders({ bars: bearTrapBars, levels })
assert(trap.trapType === 'BEAR_TRAP', 'Debe detectar bear trap al romper abajo y recuperar.')
assert(trap.trappedSide === 'SELLERS', 'Bear trap atrapa vendedores.')

done('trapped-trader-detector')
