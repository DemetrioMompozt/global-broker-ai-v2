import { getCfdQuote } from '../cfd/cfdPricingEngine.js'
import { openCfdPaperPosition } from '../cfd/cfdPaperExecutionEngine.js'
import { updateOpenPositions } from '../cfd/cfdPositionManager.js'
import { getClosedTrades, getOpenPositions } from '../storage/tradeStore.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'
import { assert, done } from './assert.js'

const quote = await getCfdQuote('BTCUSD.cfd')
assert(quote.mid > 0, 'BTC CFD quote must have a positive mid.')
const opportunity: Opportunity = {
  cfdSymbol: 'BTCUSD.cfd',
  underlyingSymbol: 'BTCUSDT',
  assetClass: 'CRYPTO_CFD',
  opportunityScore: 99,
  strategy: 'RealtimeFeedTest',
  timeframe: 'INTRADAY_SLOW',
  setupStatus: 'CONFIRMED',
  setupConfirmed: true,
  reason: 'test',
  quote,
}
const opened = await openCfdPaperPosition(opportunity, true)
assert(opened.opened, opened.reason)
assert(getOpenPositions().length === 1, 'One paper position should be created.')
await updateOpenPositions()
assert(getOpenPositions().length + getClosedTrades().length >= 1, 'Paper position should remain tracked even if fast feed reaches an exit.')
const tracked = getOpenPositions()[0] ?? getClosedTrades()[0]
assert(tracked.feedType === 'REALTIME_TICK' || tracked.feedType === 'DELAYED_INTRADAY', 'Position should use Binance feed.')

const shortOpened = await openCfdPaperPosition({ ...opportunity, direction: 'SHORT' }, true)
assert(shortOpened.opened, shortOpened.reason)
assert(shortOpened.position?.direction === 'SHORT', 'Forced short test position should be SHORT.')
assert(shortOpened.position!.stopLoss > shortOpened.position!.entryPrice, 'SHORT stop loss must be above entry.')
assert(shortOpened.position!.takeProfit < shortOpened.position!.entryPrice, 'SHORT take profit must be below entry.')
done('cfd-paper')
