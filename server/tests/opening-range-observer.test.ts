import { observeOpeningRange } from '../strategy/openingRangeObserver.js'
import { assert, done } from './assert.js'

const bars = [
  { close: 5004, high: 5008, low: 4998, open: 5001, timestamp: '2026-06-05T13:30:00.000Z', volume: 1000 },
  { close: 5008, high: 5010, low: 4999, open: 5004, timestamp: '2026-06-05T13:31:00.000Z', volume: 1000 },
  { close: 4997, high: 5009, low: 4995, open: 5008, timestamp: '2026-06-05T13:44:00.000Z', volume: 1000 },
]

let range = observeOpeningRange({ bars, now: new Date('2026-06-05T13:40:00.000Z') })
assert(range.state === 'WAITING_FIRST_15_MINUTES', 'No puede operar antes de completar 15 minutos.')

range = observeOpeningRange({ bars, now: new Date('2026-06-05T13:46:00.000Z') })
assert(range.state === 'OPENING_RANGE_COMPLETED', 'Debe completar opening range despues de 15 minutos.')
assert(range.openingRangeHigh === 5010, 'Debe calcular OR high.')
assert(range.openingRangeLow === 4995, 'Debe calcular OR low.')
assert(range.evidence.barsUsed === 3, 'Debe exponer cuantas velas uso para OR.')
assert(range.evidence.highBar?.timestamp === '2026-06-05T13:31:00.000Z', 'Debe exponer la vela exacta que genero OR high.')
assert(range.evidence.lowBar?.timestamp === '2026-06-05T13:44:00.000Z', 'Debe exponer la vela exacta que genero OR low.')

const strictWindowBars = [
  { close: 5030, high: 9999, low: 5020, open: 5025, timestamp: '2026-06-05T13:29:00.000Z', volume: 1000 },
  { close: 5004, high: 5008, low: 4998, open: 5001, timestamp: '2026-06-05T13:30:00.000Z', volume: 1000 },
  { close: 5008, high: 5010, low: 4999, open: 5004, timestamp: '2026-06-05T13:31:00.000Z', volume: 1000 },
  { close: 4997, high: 5009, low: 4995, open: 5008, timestamp: '2026-06-05T13:44:00.000Z', volume: 1000 },
  { close: 5040, high: 9998, low: 5030, open: 5035, timestamp: '2026-06-05T13:45:00.000Z', volume: 1000 },
]
range = observeOpeningRange({ bars: strictWindowBars, now: new Date('2026-06-05T13:46:00.000Z') })
assert(range.openingRangeHigh === 5010, 'OR high debe excluir 09:29 y 09:45 New York.')
assert(range.openingRangeLow === 4995, 'OR low debe excluir 09:29 y 09:45 New York.')
assert(range.evidence.barsUsed === 3, 'La evidencia debe contar solo las velas dentro de 09:30-09:44.')

done('opening-range-observer')
