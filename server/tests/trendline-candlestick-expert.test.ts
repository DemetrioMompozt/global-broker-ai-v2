import { analyzeTrendlineCandlestickExpert } from '../strategy/trendlineCandlestickExpert.js'
import { analyzeTrendlineFailureSetup } from '../strategy/trendlineFailureSetup.js'
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

const shortFailure = analyzeTrendlineFailureSetup({ bars: shortBars, direction: 'SHORT' })
const shortExpert = analyzeTrendlineCandlestickExpert({ bars: shortBars, direction: 'SHORT', trendlineFailure: shortFailure })
assert(shortExpert.status === 'CONFIRMED', `Short debe confirmar ruptura+retest, recibio ${shortExpert.status}: ${shortExpert.blockers.join(',')}`)
assert(shortExpert.evidence.breakCandle !== null, 'Debe guardar vela de ruptura.')
assert(shortExpert.evidence.retestCandle !== null, 'Debe guardar vela de retest fallido.')
assert(shortExpert.candlestickConfirmationScore >= 68, 'Velas deben tener score operativo.')

const wickOnlyBars = [
  ...shortBars.slice(0, 8),
  { open: 102.6, high: 103.0, low: 102.0, close: 102.5, timestamp: '2026-06-05T13:54:00.000Z', volume: 180 },
  { open: 102.5, high: 103.1, low: 102.2, close: 102.7, timestamp: '2026-06-05T13:55:00.000Z', volume: 180 },
  { open: 102.7, high: 103.4, low: 102.4, close: 103.1, timestamp: '2026-06-05T13:56:00.000Z', volume: 180 },
]
const wickExpert = analyzeTrendlineCandlestickExpert({ bars: wickOnlyBars, direction: 'SHORT', trendlineFailure: { ...shortFailure, canUseForEntry: false, state: 'TRENDLINE_ACTIVE' } })
assert(wickExpert.status === 'WAITING_BREAK', 'Una mecha bajo la linea no debe contar como ruptura.')
assert(wickExpert.blockers.includes('BLOCKED_BREAK_WICK_ONLY'), 'Debe explicar que fue solo mecha.')

const noRetestBars = [
  ...shortBars.slice(0, 8),
  { open: 102.8, high: 103.0, low: 101.9, close: 102.0, timestamp: '2026-06-05T13:54:00.000Z', volume: 180 },
  { open: 102.0, high: 102.2, low: 101.3, close: 101.7, timestamp: '2026-06-05T13:55:00.000Z', volume: 180 },
  { open: 101.7, high: 101.9, low: 101.0, close: 101.2, timestamp: '2026-06-05T13:56:00.000Z', volume: 180 },
]
const noRetestExpert = analyzeTrendlineCandlestickExpert({ bars: noRetestBars, direction: 'SHORT', trendlineFailure: { ...shortFailure, canUseForEntry: false, state: 'BROKEN_WITHOUT_RETEST' } })
assert(noRetestExpert.status === 'WAITING_RETEST', 'Ruptura sin retest debe esperar.')
assert(noRetestExpert.blockers.includes('BLOCKED_NO_RETEST_FAILURE'), 'Debe exigir retest fallido.')

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
const longFailure = analyzeTrendlineFailureSetup({ bars: longBars, direction: 'LONG' })
const longExpert = analyzeTrendlineCandlestickExpert({ bars: longBars, direction: 'LONG', trendlineFailure: longFailure })
assert(longExpert.status === 'CONFIRMED', `Long debe confirmar ruptura+retest, recibio ${longExpert.status}: ${longExpert.blockers.join(',')}`)
assert(longExpert.evidence.expectedTrendlineRole === 'FALLING_RESISTANCE', 'Long debe romper resistencia bajista de contramovimiento.')

done('trendline-candlestick-expert')
