import { Router } from 'express'
import { getFeedStatuses, getLivePrices } from '../feeds/livePriceService.js'

export const livePriceRouter = Router()

livePriceRouter.get('/', async (request, response) => {
  const symbols = String(request.query.symbols ?? 'BTCUSDT,ETHUSDT,SOLUSDT,XRPUSDT')
    .split(',')
    .map((symbol) => symbol.trim())
    .filter(Boolean)
  response.json({
    serverTime: new Date().toISOString(),
    prices: await getLivePrices(symbols),
    providers: getFeedStatuses(),
    realTradingAllowed: false,
    brokerExecutionEnabled: false,
  })
})
