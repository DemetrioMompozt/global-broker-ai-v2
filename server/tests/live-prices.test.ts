import '../config/env.js'
import { getLivePrice } from '../feeds/livePriceService.js'
import { assert, done } from './assert.js'

const btc = await getLivePrice('BTCUSDT')
assert(btc.asset === 'BTCUSD.cfd' || btc.asset === 'BTCUSDT', 'BTC symbol mapping should resolve.')
assert(btc.mappedSymbol === 'BTCUSDT', 'BTC should map to BTCUSDT.')
assert(btc.provider.includes('Binance'), 'BTC should use Binance.')
assert(btc.feedType === 'REALTIME_TICK' || btc.feedType === 'DELAYED_INTRADAY', 'BTC should use realtime tick or Binance REST fallback.')
assert(btc.price > 0, 'BTC price must be positive.')
assert(btc.validForPaperPositionTracking, 'BTC must be valid for paper tracking.')
done('live-prices')
