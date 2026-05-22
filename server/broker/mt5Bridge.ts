export type Mt5BridgeStatus = {
  architecture: 'HTTP_BRIDGE_OR_EA_PUSH'
  connected: boolean
  endpoints: string[]
  mode: 'DEMO_ONLY'
  orderSendDefault: 'BLOCKED'
  raw?: unknown
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
}

export type Mt5AccountInfo = {
  accountMode: 'DEMO' | 'REAL' | 'UNKNOWN'
  balance: number | null
  equity: number | null
  freeMargin: number | null
  login: string | null
  marginLevel: number | null
  server: string | null
  usedMargin: number | null
  raw?: unknown
}

export type Mt5Tick = {
  ask: number
  bid: number
  brokerTime: string | null
  lastPriceUpdate: string
  mid: number
  spread: number
  spreadBps: number
  symbol: string
  raw?: unknown
}

function bridgeBaseUrl() {
  return process.env.MT5_BRIDGE_URL ?? 'http://127.0.0.1:5190'
}

export function getMt5BridgePlan() {
  return {
    architecture: 'HTTP_BRIDGE_OR_EA_PUSH' as const,
    endpoints: ['/mt5/status', '/mt5/account', '/mt5/symbols', '/mt5/tick?symbol=...', '/mt5/positions'],
    orderSendDefault: 'BLOCKED' as const,
    mode: 'DEMO_ONLY' as const,
  }
}

async function fetchBridge(path: string, timeoutMs = 1800) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${bridgeBaseUrl()}${path}`, { signal: controller.signal })
    if (!response.ok) return null
    return await response.json() as unknown
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function probeMt5Bridge(path = '/mt5/status', timeoutMs = 1800) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${bridgeBaseUrl()}${path}`, { signal: controller.signal })
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      body = null
    }
    return {
      body,
      httpStatus: response.status,
      ok: response.ok,
      reachable: true,
      url: bridgeBaseUrl(),
    }
  } catch (error) {
    return {
      body: null,
      error: error instanceof Error ? error.message : String(error),
      httpStatus: null,
      ok: false,
      reachable: false,
      url: bridgeBaseUrl(),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function numberOrNull(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeAccountMode(raw: Record<string, unknown>): Mt5AccountInfo['accountMode'] {
  const explicit = String(raw.accountMode ?? raw.mode ?? raw.tradeMode ?? raw.accountType ?? '').toUpperCase()
  if (explicit.includes('REAL') || explicit.includes('LIVE')) return 'REAL'
  if (explicit.includes('DEMO')) return 'DEMO'
  if (raw.isDemo === true) return 'DEMO'
  if (raw.isDemo === false) return 'REAL'
  return 'UNKNOWN'
}

export async function getMt5Status(): Promise<Mt5BridgeStatus> {
  try {
    const raw = await fetchBridge('/mt5/status') ?? await fetchBridge('/mt5/health')
    if (!raw) return { ...getMt5BridgePlan(), connected: false, status: 'DISCONNECTED' }
    return { ...getMt5BridgePlan(), connected: true, raw, status: 'CONNECTED' }
  } catch {
    return { ...getMt5BridgePlan(), connected: false, status: 'ERROR' }
  }
}

export async function getMt5Account(): Promise<Mt5AccountInfo> {
  const raw = await fetchBridge('/mt5/account')
  if (!raw || typeof raw !== 'object') {
    return {
      accountMode: 'UNKNOWN',
      balance: null,
      equity: null,
      freeMargin: null,
      login: null,
      marginLevel: null,
      server: null,
      usedMargin: null,
    }
  }
  const object = raw as Record<string, unknown>
  return {
    accountMode: normalizeAccountMode(object),
    balance: numberOrNull(object.balance),
    equity: numberOrNull(object.equity),
    freeMargin: numberOrNull(object.freeMargin ?? object.marginFree),
    login: object.login === undefined ? null : String(object.login),
    marginLevel: numberOrNull(object.marginLevel),
    server: object.server === undefined ? null : String(object.server),
    usedMargin: numberOrNull(object.usedMargin ?? object.margin),
    raw,
  }
}

export async function getMt5Symbols(): Promise<string[]> {
  const symbols = await fetchBridge('/mt5/symbols')
  if (Array.isArray(symbols)) return symbols.map(String)
  if (symbols && typeof symbols === 'object' && 'symbols' in symbols && Array.isArray((symbols as { symbols: unknown[] }).symbols)) {
    return (symbols as { symbols: unknown[] }).symbols
      .map((symbol) => {
        if (typeof symbol === 'string') return symbol
        if (symbol && typeof symbol === 'object' && 'name' in symbol) return String((symbol as { name: unknown }).name)
        return String(symbol)
      })
      .filter((symbol) => symbol && symbol !== '[object Object]')
  }

  const pushed = await fetchBridge('/mt5/pushed-ticks')
  if (pushed && typeof pushed === 'object' && 'ticks' in pushed && Array.isArray((pushed as { ticks: unknown[] }).ticks)) {
    return [...new Set((pushed as { ticks: Array<Record<string, unknown>> }).ticks.map((tick) => String(tick.symbol ?? '')).filter(Boolean))]
  }
  return []
}

function normalizeTick(raw: unknown, requestedSymbol: string): Mt5Tick | null {
  if (!raw || typeof raw !== 'object') return null
  const object = raw as Record<string, unknown>
  const bid = Number(object.bid)
  const ask = Number(object.ask)
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= bid) return null
  const mid = Number(object.mid ?? ((bid + ask) / 2))
  const brokerTimeMsc = Number(object.timeMsc ?? 0)
  const receivedAt = new Date().toISOString()
  return {
    ask,
    bid,
    brokerTime: Number.isFinite(brokerTimeMsc) && brokerTimeMsc > 0 ? new Date(brokerTimeMsc).toISOString() : null,
    lastPriceUpdate: receivedAt,
    mid,
    raw,
    spread: ask - bid,
    spreadBps: mid > 0 ? (ask - bid) / mid * 10_000 : 0,
    symbol: String(object.symbol ?? requestedSymbol),
  }
}

export async function getMt5Tick(symbol: string): Promise<Mt5Tick | null> {
  const queryTick = await fetchBridge(`/mt5/tick?symbol=${encodeURIComponent(symbol)}`)
  const normalizedQuery = normalizeTick(queryTick, symbol)
  if (normalizedQuery) return normalizedQuery

  const pathTick = await fetchBridge(`/mt5/tick/${encodeURIComponent(symbol)}`)
  return normalizeTick(pathTick, symbol)
}

export async function getMt5Positions() {
  const raw = await fetchBridge('/mt5/positions')
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'object' && 'positions' in raw && Array.isArray((raw as { positions: unknown[] }).positions)) return (raw as { positions: unknown[] }).positions
  return []
}
