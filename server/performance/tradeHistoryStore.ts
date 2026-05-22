import { getClosedTrades } from '../storage/tradeStore.js'

export function getTradeHistory() {
  return getClosedTrades()
}
