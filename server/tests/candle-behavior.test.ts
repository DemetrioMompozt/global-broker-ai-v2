import { evaluateCandleBehavior, recordCfdCandleTick } from '../strategy/candleBehaviorEngine.js'
import { assert, done } from './assert.js'

const symbol = `TEST${Date.now()}.cfd`
const now = Date.now()

recordCfdCandleTick(symbol, 1.0000, now - 20_000)
recordCfdCandleTick(symbol, 1.0004, now - 19_000)
recordCfdCandleTick(symbol, 1.0007, now - 15_000)
recordCfdCandleTick(symbol, 1.0008, now - 14_000)
recordCfdCandleTick(symbol, 1.0011, now - 10_000)
recordCfdCandleTick(symbol, 1.0016, now - 9_000)
recordCfdCandleTick(symbol, 1.0022, now - 5_000)
recordCfdCandleTick(symbol, 1.0028, now - 4_000)

const longReadout = evaluateCandleBehavior(symbol, 'VT_MARKETS_MT5_DEMO', 'LONG')
assert(longReadout.available, 'Debe tener velas cerradas suficientes.')
assert(longReadout.score > 50, 'Tendencia alcista debe tener score positivo para LONG.')
assert(longReadout.pattern !== 'INSUFFICIENT_CANDLES', 'Debe clasificar comportamiento de vela.')

const shortReadout = evaluateCandleBehavior(symbol, 'VT_MARKETS_MT5_DEMO', 'SHORT')
assert(shortReadout.signal === 'BLOCKS_ENTRY' || shortReadout.score < longReadout.score, 'La misma secuencia debe ser peor para SHORT.')

done('candle-behavior')
