import http from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { saveBridgeEnv } from '../broker/bridgeEnvCheck.js'
import { scanMultiSourceOpportunities } from '../strategy/multiSourceOpportunityEngine.js'
import { assert, done } from './assert.js'

const originalEnv = { ...process.env }
const tempDir = mkdtempSync(path.join(tmpdir(), 'multi-source-test-'))

function startBridge() {
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json')
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    if (url.pathname === '/mt5/status') {
      response.end(JSON.stringify({ ok: true, connected: true, mode: 'DEMO', readOnly: true, orderSendAllowed: false, realTradingAllowed: false, accountType: 'DEMO' }))
      return
    }
    if (url.pathname === '/mt5/account') {
      response.end(JSON.stringify({ accountMode: 'DEMO', accountType: 'DEMO', balance: 100000, equity: 100000, freeMargin: 100000, marginLevel: 9999, usedMargin: 0 }))
      return
    }
    if (url.pathname === '/mt5/symbols') {
      response.end(JSON.stringify({ symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'NAS100', 'US500', 'XAUUSD'] }))
      return
    }
    if (url.pathname === '/mt5/tick') {
      const symbol = url.searchParams.get('symbol') ?? 'EURUSD'
      const prices: Record<string, number> = { EURUSD: 1.08, GBPUSD: 1.27, USDJPY: 156.2, USDCHF: 0.91, NAS100: 18800, US500: 5250, XAUUSD: 2380 }
      const mid = prices[symbol] ?? 1
      const spread = symbol.includes('USD') && mid < 2 ? 0.00008 : mid * 0.00005
      response.end(JSON.stringify({ symbol, bid: mid - spread / 2, ask: mid + spread / 2, mid, spread, spreadBps: spread / mid * 10000, timeMsc: Date.now() }))
      return
    }
    if (url.pathname === '/mt5/positions') {
      response.end(JSON.stringify({ positions: [] }))
      return
    }
    response.statusCode = 404
    response.end(JSON.stringify({ error: 'not found' }))
  })
  return new Promise<{ close: () => Promise<void>; port: number }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve({
        close: () => new Promise((closeResolve) => server.close(() => closeResolve())),
        port: typeof address === 'object' && address ? address.port : 0,
      })
    })
  })
}

const bridge = await startBridge()
process.env = {
  ...originalEnv,
  MT5_BRIDGE_ENV_PATH: path.join(tempDir, '.env'),
  MT5_BRIDGE_URL: `http://127.0.0.1:${bridge.port}`,
}
saveBridgeEnv({ login: '123456', password: 'demo-password', server: 'VTMarkets-Demo' })

try {
  const scan = await scanMultiSourceOpportunities()
  assert(scan.opportunities.some((opportunity) => opportunity.source === 'VT_MARKETS_MT5_DEMO'), 'Scanner must produce VT Markets opportunities when VT demo is connected.')
  assert(scan.opportunities.some((opportunity) => opportunity.cfdSymbol === 'EURUSD.cfd'), 'Scanner must include EURUSD.cfd from VT.')
  assert(scan.opportunities.some((opportunity) => opportunity.source === 'BINANCE_REALTIME'), 'Scanner must include Binance crypto opportunities.')
} finally {
  await bridge.close()
  rmSync(tempDir, { force: true, recursive: true })
  process.env = { ...originalEnv }
}

done('multi-source-opportunities')
