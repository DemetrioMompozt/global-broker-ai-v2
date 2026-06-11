import { analyzeWeakCountermoveTrendline } from '../strategy/weakCountermoveTrendlineEngine.js'
import { assert, done } from './assert.js'

const shortBars = [
  { open: 101.4, high: 101.8, low: 100.8, close: 101.2, timestamp: '2026-06-05T13:46:00.000Z', volume: 100 },
  { open: 100.8, high: 101.6, low: 100.0, close: 101.0, timestamp: '2026-06-05T13:47:00.000Z', volume: 100 },
  { open: 101.1, high: 102.0, low: 100.8, close: 101.7, timestamp: '2026-06-05T13:48:00.000Z', volume: 110 },
  { open: 101.8, high: 102.8, low: 101.4, close: 102.3, timestamp: '2026-06-05T13:49:00.000Z', volume: 90 },
  { open: 101.7, high: 102.6, low: 101.0, close: 102.1, timestamp: '2026-06-05T13:50:00.000Z', volume: 120 },
  { open: 102.2, high: 103.0, low: 101.6, close: 102.7, timestamp: '2026-06-05T13:51:00.000Z', volume: 100 },
  { open: 102.8, high: 103.6, low: 102.5, close: 103.2, timestamp: '2026-06-05T13:52:00.000Z', volume: 140 },
  { open: 102.6, high: 103.2, low: 102.0, close: 102.8, timestamp: '2026-06-05T13:53:00.000Z', volume: 160 },
  { open: 102.8, high: 103.0, low: 102.1, close: 102.2, timestamp: '2026-06-05T13:54:00.000Z', volume: 180 },
  { open: 102.4, high: 103.4, low: 102.0, close: 102.3, timestamp: '2026-06-05T13:55:00.000Z', volume: 180 },
  { open: 102.5, high: 102.7, low: 101.5, close: 101.9, timestamp: '2026-06-05T13:56:00.000Z', volume: 190 },
  { open: 101.9, high: 102.1, low: 101.0, close: 101.4, timestamp: '2026-06-05T13:57:00.000Z', volume: 200 },
]

const short = analyzeWeakCountermoveTrendline({
  bars: shortBars,
  levels: {
    openingRangeHigh: 101.5,
    openingRangeLow: 90,
    overnightHigh: null,
    overnightLow: null,
    previousDayClose: null,
    previousDayHigh: null,
    previousDayLow: null,
    sessionHigh: null,
    sessionLow: null,
  },
})
assert(short.trappedSide === 'BUYERS', 'Debe detectar compradores atrapados si rompe/probamos ORH y vuelve debajo.')
assert(short.intendedDirection === 'SHORT', 'Compradores atrapados preparan posible short.')
assert(short.weakCountermoveScore >= 40, 'Debe exigir contramovimiento debil antes de usar trendline.')
assert(short.trendlineFailure?.trendline?.anchorCount === 3, 'La linea del contramovimiento debe ser de tres puntos.')
assert(short.state === 'RETEST_FAILED', `Debe esperar ruptura y retest fallido antes de entry short: ${short.reason}`)
assert(short.canUseForEntry, 'Solo el retest fallido debe autorizar pasar al risk box.')

const longBars = [
  { open: 103.4, high: 104.2, low: 102.8, close: 103.8, timestamp: '2026-06-05T13:46:00.000Z', volume: 100 },
  { open: 104.2, high: 105.0, low: 103.5, close: 104.0, timestamp: '2026-06-05T13:47:00.000Z', volume: 120 },
  { open: 103.8, high: 104.5, low: 102.4, close: 103.0, timestamp: '2026-06-05T13:48:00.000Z', volume: 90 },
  { open: 102.8, high: 103.8, low: 101.8, close: 102.5, timestamp: '2026-06-05T13:49:00.000Z', volume: 95 },
  { open: 103.0, high: 104.0, low: 102.0, close: 102.7, timestamp: '2026-06-05T13:50:00.000Z', volume: 90 },
  { open: 102.5, high: 103.5, low: 101.6, close: 102.2, timestamp: '2026-06-05T13:51:00.000Z', volume: 110 },
  { open: 102.0, high: 102.8, low: 101.2, close: 101.8, timestamp: '2026-06-05T13:52:00.000Z', volume: 100 },
  { open: 102.1, high: 103.0, low: 101.5, close: 102.3, timestamp: '2026-06-05T13:53:00.000Z', volume: 180 },
  { open: 102.5, high: 103.0, low: 101.9, close: 102.9, timestamp: '2026-06-05T13:54:00.000Z', volume: 150 },
  { open: 102.9, high: 104.1, low: 102.2, close: 103.2, timestamp: '2026-06-05T13:55:00.000Z', volume: 170 },
  { open: 103.1, high: 104.5, low: 102.8, close: 104.0, timestamp: '2026-06-05T13:56:00.000Z', volume: 180 },
  { open: 104.0, high: 105.0, low: 103.6, close: 104.7, timestamp: '2026-06-05T13:57:00.000Z', volume: 190 },
]

const long = analyzeWeakCountermoveTrendline({
  bars: longBars,
  levels: {
    openingRangeHigh: 112,
    openingRangeLow: 103.2,
    overnightHigh: null,
    overnightLow: null,
    previousDayClose: null,
    previousDayHigh: null,
    previousDayLow: null,
    sessionHigh: null,
    sessionLow: null,
  },
})
assert(long.trappedSide === 'SELLERS', 'Debe detectar vendedores atrapados si rompe/probamos ORL y recupera arriba.')
assert(long.intendedDirection === 'LONG', 'Vendedores atrapados preparan posible long.')
assert(long.trendlineFailure?.trendline?.anchorCount === 3, 'La linea long tambien debe exigir tres puntos.')
assert(long.state === 'RETEST_FAILED', `Debe esperar ruptura y retest fallido antes de entry long: ${long.reason}`)
assert(long.canUseForEntry, 'Solo el retest fallido debe autorizar pasar al risk box para long.')

const noOpeningRangeFailure = analyzeWeakCountermoveTrendline({
  bars: shortBars.map((bar) => ({ ...bar, high: Math.min(bar.high, 100), close: Math.min(bar.close, 100) })),
  levels: {
    openingRangeHigh: 105,
    openingRangeLow: 90,
    overnightHigh: null,
    overnightLow: null,
    previousDayClose: null,
    previousDayHigh: null,
    previousDayLow: null,
    sessionHigh: null,
    sessionLow: null,
  },
})
assert(noOpeningRangeFailure.state === 'OPENING_RANGE_MARKED', 'Sin interaccion real con ORH/ORL no debe dibujar trendline.')
assert(!noOpeningRangeFailure.canUseForEntry, 'No debe entrar sin primero evidenciar debilidad/atrapados en open range.')

const acceptedBreakoutAfterInitialFailure = analyzeWeakCountermoveTrendline({
  bars: [
    { open: 100.2, high: 101.2, low: 99.8, close: 100.8, timestamp: '2026-06-05T13:45:00.000Z', volume: 100 },
    { open: 100.8, high: 101.0, low: 99.0, close: 99.4, timestamp: '2026-06-05T13:46:00.000Z', volume: 100 },
    { open: 99.4, high: 101.4, low: 99.2, close: 101.0, timestamp: '2026-06-05T13:47:00.000Z', volume: 100 },
    { open: 101.0, high: 102.0, low: 100.8, close: 101.7, timestamp: '2026-06-05T13:48:00.000Z', volume: 100 },
    { open: 101.7, high: 102.4, low: 101.4, close: 102.0, timestamp: '2026-06-05T13:49:00.000Z', volume: 100 },
  ],
  levels: {
    openingRangeHigh: 100,
    openingRangeLow: 90,
    overnightHigh: null,
    overnightLow: null,
    previousDayClose: null,
    previousDayHigh: null,
    previousDayLow: null,
    sessionHigh: null,
    sessionLow: null,
  },
})
assert(acceptedBreakoutAfterInitialFailure.state === 'BREAKOUT_ACCEPTED', 'Si recupera y sostiene sobre ORH, no debe seguir marcando compradores atrapados.')
assert(acceptedBreakoutAfterInitialFailure.trappedSide === 'NONE', 'Breakout aceptado invalida la trampa previa.')

const missedShortThenLateAcceptance = analyzeWeakCountermoveTrendline({
  bars: [
    ...shortBars,
    { open: 101.4, high: 101.8, low: 100.9, close: 101.2, timestamp: '2026-06-05T13:58:00.000Z', volume: 190 },
    { open: 101.2, high: 101.6, low: 100.4, close: 100.8, timestamp: '2026-06-05T13:59:00.000Z', volume: 210 },
    { open: 100.8, high: 101.1, low: 100.0, close: 100.4, timestamp: '2026-06-05T14:00:00.000Z', volume: 230 },
    { open: 100.4, high: 102.2, low: 100.2, close: 101.9, timestamp: '2026-06-05T14:01:00.000Z', volume: 160 },
    { open: 101.9, high: 102.6, low: 101.8, close: 102.2, timestamp: '2026-06-05T14:02:00.000Z', volume: 160 },
    { open: 102.2, high: 102.8, low: 102.0, close: 102.4, timestamp: '2026-06-05T14:03:00.000Z', volume: 160 },
  ],
  levels: {
    openingRangeHigh: 101.5,
    openingRangeLow: 90,
    overnightHigh: null,
    overnightLow: null,
    previousDayClose: null,
    previousDayHigh: null,
    previousDayLow: null,
    sessionHigh: null,
    sessionLow: null,
  },
})
assert(missedShortThenLateAcceptance.state !== 'BREAKOUT_ACCEPTED', 'Una aceptacion tardia no debe borrar una oportunidad short intradia ya formada.')
assert(missedShortThenLateAcceptance.missedOpportunities.length >= 1, 'Debe recordar oportunidades intradia perdidas para auditoria del agente.')
assert(missedShortThenLateAcceptance.latestMissedOpportunity?.direction === 'SHORT', 'La oportunidad perdida debe quedar clasificada como short.')

done('weak-countermove-trendline')
