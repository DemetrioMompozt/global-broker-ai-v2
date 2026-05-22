import http from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { connectVtMarketsDemo } from '../broker/vtMarketsConnectionWizard.js'
import { getStatus, safetyCheck } from '../broker/vtMarketsConnector.js'
import { getVtMarketsCfdPrice } from '../feeds/vtMarketsPriceProvider.js'
import { mapVtMarketsSymbol } from '../symbols/vtMarketsSymbolMapper.js'
import { assert, done } from './assert.js'

const originalEnv = { ...process.env }
const tempDir = mkdtempSync(path.join(tmpdir(), 'vt-markets-test-'))
const missingBridgeEnvPath = path.join(tempDir, 'missing.env')

async function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  process.env = { ...originalEnv, MT5_BRIDGE_ENV_PATH: missingBridgeEnvPath, MT5_BRIDGE_URL: 'http://127.0.0.1:9', ...env }
  try {
    await fn()
  } finally {
    process.env = { ...originalEnv }
  }
}

await withEnv({ VT_MARKETS_ENABLED: 'false' }, async () => {
  const status = await getStatus()
  assert(status.status === 'NOT_CONFIGURED', 'Disabled VT must return NOT_CONFIGURED.')
})

await withEnv({
  VT_MARKETS_ENABLED: 'true',
  VT_MARKETS_MODE: 'REAL',
  VT_MARKETS_SERVER: 'demo-server',
  VT_MARKETS_LOGIN: '123456',
  VT_MARKETS_INVESTOR_PASSWORD: 'secret',
}, async () => {
  const status = await getStatus()
  assert(status.status === 'BLOCKED_BY_SAFETY', 'Non-DEMO VT mode must be blocked.')
})

await withEnv({
  VT_MARKETS_ENABLED: 'true',
  VT_MARKETS_REAL_TRADING_ALLOWED: 'true',
  VT_MARKETS_SERVER: 'demo-server',
  VT_MARKETS_LOGIN: '123456',
  VT_MARKETS_INVESTOR_PASSWORD: 'secret',
}, async () => {
  const status = await getStatus()
  assert(status.status === 'BLOCKED_BY_SAFETY', 'VT real trading flag must be blocked.')
})

await withEnv({
  VT_MARKETS_ENABLED: 'true',
  VT_MARKETS_ALLOW_ORDER_SEND: 'true',
  VT_MARKETS_SERVER: 'demo-server',
  VT_MARKETS_LOGIN: '123456',
  VT_MARKETS_INVESTOR_PASSWORD: 'secret',
}, () => {
  assert(safetyCheck().blocked, 'Order send must be blocked in read-only phase.')
})

const matched = mapVtMarketsSymbol('NAS100.cfd', ['US100.cash'])
assert(matched.mappingStatus === 'MATCHED', 'NAS100 should map to available US100.cash.')
assert(matched.brokerSymbol === 'US100.cash', 'Mapper should preserve actual broker symbol.')

const missing = mapVtMarketsSymbol('ETHUSD.cfd', ['EURUSD'])
assert(missing.mappingStatus === 'NOT_FOUND', 'Missing VT symbol must be NOT_FOUND.')

await withEnv({ VT_MARKETS_ENABLED: 'false' }, async () => {
  const price = await getVtMarketsCfdPrice('NAS100.cfd')
  assert(price === null, 'VT price provider should be null when VT is not connected.')
})

await withEnv({ MT5_BRIDGE_ENV_PATH: path.join(tempDir, 'wizard-needs-connector.env'), MT5_CONNECTOR_DRY_RUN: 'true' }, async () => {
  const result = await connectVtMarketsDemo({ login: '123456', password: 'demo-password', server: 'VTMarkets-Demo' })
  assert(result.status === 'NEEDS_CONNECTOR', 'Wizard should return NEEDS_CONNECTOR when bridge is not active.')
  assert(result.technical.connector?.attempted === true, 'Wizard should try to start local connector automatically.')
  assert(!JSON.stringify(result).includes('demo-password'), 'Wizard response must not expose password.')
})

await withEnv({ MT5_BRIDGE_ENV_PATH: path.join(tempDir, 'wizard-saved-config.env'), MT5_CONNECTOR_DRY_RUN: 'true' }, async () => {
  await connectVtMarketsDemo({ login: '123456', password: 'demo-password', server: 'VTMarkets-Demo' })
  const result = await connectVtMarketsDemo({})
  assert(result.status === 'NEEDS_CONNECTOR', 'Wizard should reuse saved bridge env when UI sends no credentials.')
  assert(result.technical.saved === null, 'Wizard should not rewrite saved env when using existing config.')
})

function startDemoBridge() {
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json')
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    if (url.pathname === '/mt5/status') {
      response.end(JSON.stringify({ ok: true, connected: true, mode: 'DEMO', readOnly: true, orderSendAllowed: false, realTradingAllowed: false, accountType: 'DEMO' }))
      return
    }
    if (url.pathname === '/mt5/account') {
      response.end(JSON.stringify({ accountMode: 'DEMO', accountType: 'DEMO', balance: 10000, equity: 10010, freeMargin: 9950, login: '12***56', marginLevel: 2000, server: 'VTMarkets-Demo', usedMargin: 50 }))
      return
    }
    if (url.pathname === '/mt5/symbols') {
      response.end(JSON.stringify({ symbols: ['NAS100', 'XAUUSD', 'EURUSD'] }))
      return
    }
    if (url.pathname === '/mt5/tick') {
      response.end(JSON.stringify({ symbol: 'NAS100', bid: 18000, ask: 18000.8, mid: 18000.4, spread: 0.8, spreadBps: 0.44, provider: 'MT5 Demo', feedType: 'BROKER_DEMO_REALTIME', pricingQuality: 'LIVE_BID_ASK', readOnly: true }))
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
        port: typeof address === 'object' && address ? address.port : 0,
        close: () => new Promise((closeResolve) => server.close(() => closeResolve())),
      })
    })
  })
}

const mock = await startDemoBridge()
try {
  await withEnv({
    MT5_BRIDGE_ENV_PATH: path.join(tempDir, 'wizard-connected.env'),
    MT5_BRIDGE_URL: `http://127.0.0.1:${mock.port}`,
  }, async () => {
    const result = await connectVtMarketsDemo({ login: '123456', password: 'demo-password', server: 'VTMarkets-Demo' })
    assert(result.status === 'CONNECTED_DEMO_READ_ONLY', 'Wizard should connect when bridge returns demo read-only account.')
    assert(result.safety.realTradingAllowed === false, 'Wizard must keep realTradingAllowed=false.')
  })
} finally {
  await mock.close()
}

const uiSource = readFileSync(path.resolve(process.cwd(), 'src/components/dashboard/VTMarketsReadiness.tsx'), 'utf8')
const simpleSource = uiSource.slice(uiSource.indexOf('<section className="panel vt-simple">'), uiSource.indexOf('<details className="advanced-diagnostics">'))
assert(!simpleSource.includes('python mt5_bridge.py'), 'Simple VT UI must not show python bridge command.')
assert(!simpleSource.includes('requirements.txt'), 'Simple VT UI must not show requirements.txt.')
assert(!simpleSource.includes('MT5_HOST'), 'Simple VT UI must not show MT5_HOST.')
assert(!simpleSource.includes('MT5_PORT'), 'Simple VT UI must not show MT5_PORT.')
assert(!simpleSource.includes('.env'), 'Simple VT UI must not show .env.')
assert(uiSource.includes('advanced-diagnostics'), 'Advanced diagnostics must exist.')
assert(!uiSource.includes('BUY') && !uiSource.includes('SELL'), 'UI must not expose BUY/SELL buttons.')

rmSync(tempDir, { force: true, recursive: true })
done('vt-markets')
