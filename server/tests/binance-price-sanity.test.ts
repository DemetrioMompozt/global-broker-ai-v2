import {
  isReasonableBinanceCryptoPrice,
  isReasonableBinanceCryptoQuote,
} from '../feeds/binanceLivePriceProvider.js'
import { assert, done } from './assert.js'

assert(isReasonableBinanceCryptoPrice('BTCUSDT', 77_500), 'BTC normal price should pass.')
assert(isReasonableBinanceCryptoPrice('ETHUSDT', 2_130), 'ETH normal price should pass.')
assert(isReasonableBinanceCryptoPrice('SOLUSDT', 145), 'SOL normal price should pass.')
assert(isReasonableBinanceCryptoPrice('XRPUSDT', 0.63), 'XRP normal price should pass.')

assert(!isReasonableBinanceCryptoPrice('ETHUSDT', 1_434_653_674), 'ETH exchange update ids must never pass as prices.')
assert(!isReasonableBinanceCryptoPrice('BTCUSDT', 1), 'BTC impossible low price must be rejected.')
assert(!isReasonableBinanceCryptoPrice('XRPUSDT', 5_000), 'XRP impossible high price must be rejected.')

const goodEthQuote = isReasonableBinanceCryptoQuote('ETHUSDT', {
  bid: 2_129.9,
  ask: 2_130.1,
  price: 2_130,
})
assert(goodEthQuote.ok, goodEthQuote.reason)

const corruptedEthQuote = isReasonableBinanceCryptoQuote('ETHUSDT', {
  bid: 1_434_653_674,
  ask: 1_434_653_682,
  price: 1_434_653_678,
})
assert(!corruptedEthQuote.ok, 'Corrupted ETH bid/ask must be rejected.')

const wideSpread = isReasonableBinanceCryptoQuote('BTCUSDT', {
  bid: 75_000,
  ask: 80_000,
  price: 77_500,
})
assert(!wideSpread.ok, 'Absurd Binance spread must be rejected.')

const jump = isReasonableBinanceCryptoQuote('BTCUSDT', { price: 120_000 }, 77_500)
assert(!jump.ok, 'Single tick jumps above 25% must be rejected.')

done('binance-price-sanity')
