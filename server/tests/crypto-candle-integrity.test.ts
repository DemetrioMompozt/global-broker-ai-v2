import { recordCryptoTick, getCryptoCandles } from '../strategy/cryptoCandleBuilder.js'
import { confirmCryptoSetup } from '../strategy/setupConfirmationEngine.js'
import { assert, done } from './assert.js'

const symbol = `TESTBTC${Date.now()}USDT`
const now = Date.now()

recordCryptoTick(symbol, 100_000, 1, now - 35_000)
recordCryptoTick(symbol, 100_050, 1, now - 30_000)
recordCryptoTick(symbol, 100_080, 1, now - 25_000)

recordCryptoTick(symbol, 1, 1, 12345)
recordCryptoTick(symbol, 10, 1, now - 20_000)

const candles = getCryptoCandles(symbol, '5s', false)
assert(candles.every((candle) => candle.close > 50_000), 'Crypto candle builder must reject impossible price jumps.')
assert(candles.every((candle) => new Date(candle.startTime).getFullYear() >= 2025), 'Crypto candle builder must reject non-epoch exchange update ids as timestamps.')

const bad = `BADBTC${Date.now()}USDT`
for (let i = 12; i > 0; i -= 1) {
  recordCryptoTick(bad, i === 1 ? 10 : 100_000 + i, 1, now - i * 5_000)
}
const setup = confirmCryptoSetup(bad)
assert(setup.setupStatus !== 'CONFIRMED', 'Anomalous crypto candles must not confirm entries.')

done('crypto-candle-integrity')
