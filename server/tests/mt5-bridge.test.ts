import http from 'node:http'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { checkBridgeEnv, saveBridgeEnv } from '../broker/bridgeEnvCheck.js'
import { getAccount, getPositions, getStatus, getSymbols, getTick } from '../broker/vtMarketsConnector.js'
import { assert, done } from './assert.js'

const originalEnv = { ...process.env }
const tempDir = mkdtempSync(path.join(tmpdir(), 'mt5-bridge-test-'))

const missingEnv = checkBridgeEnv(path.join(tempDir, '.env'))
assert(!missingEnv.exists, 'Should detect missing bridge .env.')

const partialPath = path.join(tempDir, 'partial.env')
writeFileSync(partialPath, 'MT5_MODE=DEMO\nMT5_READ_ONLY=true\nMT5_ALLOW_ORDER_SEND=false\nMT5_REAL_TRADING_ALLOWED=false\n')
const partialEnv = checkBridgeEnv(partialPath)
assert(partialEnv.exists && !partialEnv.valid, 'Partial env should be invalid.')
assert(partialEnv.missingVariables.includes('MT5_SERVER'), 'Partial env should report missing MT5_SERVER.')

const unsafePath = path.join(tempDir, 'unsafe.env')
writeFileSync(unsafePath, [
  'MT5_MODE=REAL',
  'MT5_SERVER=demo',
  'MT5_LOGIN=123',
  'MT5_PASSWORD=secret',
  'MT5_READ_ONLY=false',
  'MT5_ALLOW_ORDER_SEND=true',
  'MT5_REAL_TRADING_ALLOWED=true',
  'MT5_HOST=127.0.0.1',
  'MT5_PORT=5190',
].join('\n'))
const unsafeEnv = checkBridgeEnv(unsafePath)
assert(!unsafeEnv.valid, 'Unsafe env should be invalid.')
assert(unsafeEnv.unsafeVariables.length >= 4, 'Unsafe env should report unsafe variables.')
assert(!unsafeEnv.presentVariables.includes('MT5_PASSWORD'), 'Env check must not expose password.')

const validPath = path.join(tempDir, 'valid.env')
writeFileSync(validPath, [
  'MT5_MODE=DEMO',
  'MT5_SERVER=demo',
  'MT5_LOGIN=123',
  'MT5_PASSWORD=secret',
  'MT5_READ_ONLY=true',
  'MT5_ALLOW_ORDER_SEND=false',
  'MT5_REAL_TRADING_ALLOWED=false',
  'MT5_HOST=127.0.0.1',
  'MT5_PORT=5190',
].join('\n'))
assert(checkBridgeEnv(validPath).valid, 'Valid demo read-only env should pass.')

const savedPath = path.join(tempDir, 'saved.env')
const saved = saveBridgeEnv({ login: '987654', password: 'super-secret-demo-password', server: 'VTMarkets-Demo' }, savedPath)
const savedContent = readFileSync(savedPath, 'utf8')
assert(saved.ok && saved.envCreated, 'saveBridgeEnv should create bridge .env.')
assert(saved.loginMasked === '****7654', 'saveBridgeEnv should mask login.')
assert(!JSON.stringify(saved).includes('super-secret-demo-password'), 'saveBridgeEnv response must not expose password.')
assert(savedContent.includes('MT5_MODE=DEMO'), 'saveBridgeEnv should force DEMO mode.')
assert(savedContent.includes('MT5_READ_ONLY=true'), 'saveBridgeEnv should force read-only.')
assert(savedContent.includes('MT5_ALLOW_ORDER_SEND=false'), 'saveBridgeEnv should force order send false.')
assert(savedContent.includes('MT5_REAL_TRADING_ALLOWED=false'), 'saveBridgeEnv should force real trading false.')
assert(checkBridgeEnv(savedPath).valid, 'Saved env should pass bridge-env-check.')

function startMockBridge() {
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json')
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')

    if (url.pathname === '/mt5/status') {
      response.end(JSON.stringify({
        ok: true,
        connected: true,
        mode: 'DEMO',
        readOnly: true,
        orderSendAllowed: false,
        realTradingAllowed: false,
        accountDetected: true,
        accountType: 'DEMO',
        server: 'VTMarkets-Demo',
        timestamp: new Date().toISOString(),
      }))
      return
    }
    if (url.pathname === '/mt5/account') {
      response.end(JSON.stringify({
        login: '12***56',
        server: 'VTMarkets-Demo',
        currency: 'USD',
        balance: 10000,
        equity: 10025,
        margin: 125,
        usedMargin: 125,
        freeMargin: 9900,
        marginLevel: 8020,
        leverage: 100,
        tradeAllowed: true,
        accountType: 'DEMO',
        accountMode: 'DEMO',
        readOnly: true,
      }))
      return
    }
    if (url.pathname === '/mt5/symbols') {
      response.end(JSON.stringify({ symbols: ['NAS100', 'XAUUSD', 'EURUSD'], readOnly: true }))
      return
    }
    if (url.pathname === '/mt5/tick') {
      response.end(JSON.stringify({
        symbol: url.searchParams.get('symbol') ?? 'NAS100',
        bid: 18500.1,
        ask: 18500.7,
        mid: 18500.4,
        spread: 0.6,
        spreadBps: 0.324,
        timeMsc: Date.now(),
        provider: 'MT5 Demo',
        feedType: 'BROKER_DEMO_REALTIME',
        pricingQuality: 'LIVE_BID_ASK',
        readOnly: true,
      }))
      return
    }
    if (url.pathname === '/mt5/positions') {
      response.end(JSON.stringify({ positions: [], readOnly: true }))
      return
    }
    response.statusCode = 404
    response.end(JSON.stringify({ error: 'not found' }))
  })
  return new Promise<{ close: () => Promise<void>; port: number }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        port,
        close: () => new Promise((closeResolve) => server.close(() => closeResolve())),
      })
    })
  })
}

process.env = {
  ...originalEnv,
  MT5_BRIDGE_ENV_PATH: path.join(tempDir, 'connector-missing.env'),
  MT5_BRIDGE_URL: 'http://127.0.0.1:9',
  VT_MARKETS_ENABLED: 'true',
  VT_MARKETS_MODE: 'DEMO',
  VT_MARKETS_SERVER: 'VTMarkets-Demo',
  VT_MARKETS_LOGIN: '123456',
  VT_MARKETS_INVESTOR_PASSWORD: 'readonly',
  VT_MARKETS_PASSWORD: '',
  VT_MARKETS_READ_ONLY: 'true',
  VT_MARKETS_ALLOW_ORDER_SEND: 'false',
  VT_MARKETS_REAL_TRADING_ALLOWED: 'false',
}

const disconnected = await getStatus()
assert(disconnected.status === 'CONFIGURED_BUT_DISCONNECTED' || disconnected.status === 'ERROR', 'Without mock bridge, VT should be disconnected/error but app-safe.')

const mock = await startMockBridge()
process.env.MT5_BRIDGE_URL = `http://127.0.0.1:${mock.port}`

try {
  const status = await getStatus()
  assert(status.status === 'CONNECTED_DEMO_READ_ONLY', 'Mock bridge should produce CONNECTED_DEMO_READ_ONLY.')
  const account = await getAccount()
  assert(account.balance === 10000, 'Account balance should be read from mock MT5 bridge.')
  const symbols = await getSymbols()
  assert(symbols.includes('NAS100'), 'Symbols should be read from mock MT5 bridge.')
  const tick = await getTick('NAS100')
  assert(tick?.bid === 18500.1, 'Tick bid should be read from mock MT5 bridge.')
  const positions = await getPositions()
  assert(Array.isArray(positions), 'Positions should be read from mock MT5 bridge.')
} finally {
  await mock.close()
  rmSync(tempDir, { force: true, recursive: true })
  process.env = { ...originalEnv }
}

done('mt5-bridge')
