import { boolEnv } from '../config/env.js'
import { getSafetyConfig } from '../config/safetyConfig.js'
import { checkBridgeEnv } from './bridgeEnvCheck.js'
import { getMt5Account, getMt5Positions, getMt5Status, getMt5Symbols, getMt5Tick, type Mt5AccountInfo } from './mt5Bridge.js'

export type VtMarketsStatusValue =
  | 'BLOCKED_BY_SAFETY'
  | 'CONFIGURED_BUT_DISCONNECTED'
  | 'CONNECTED_DEMO_READ_ONLY'
  | 'ERROR'
  | 'NOT_CONFIGURED'

export type VtMarketsStatus = {
  accountType: 'MT5_DEMO' | 'REAL_BLOCKED' | 'UNKNOWN'
  broker: 'VT Markets'
  connected: boolean
  enabled: boolean
  loginMasked: string
  mode: 'DEMO'
  orderSendAllowed: false
  platform: 'MT5'
  readOnly: true
  realTradingAllowed: false
  server: string
  status: VtMarketsStatusValue
  warnings: string[]
}

function envValue(name: string) {
  return process.env[name] ?? ''
}

function maskLogin(login: string) {
  if (!login) return ''
  if (login.length <= 3) return '***'
  return `${login.slice(0, 2)}***${login.slice(-2)}`
}

function configured() {
  return boolEnv('VT_MARKETS_ENABLED', false) || checkBridgeEnv().valid
}

let statusCache: { at: number; key: string; value: VtMarketsStatus } | null = null
let symbolsCache: { at: number; value: string[] } | null = null

function statusCacheKey() {
  return [
    process.env.VT_MARKETS_MODE,
    process.env.VT_MARKETS_READ_ONLY,
    process.env.VT_MARKETS_ALLOW_ORDER_SEND,
    process.env.VT_MARKETS_REAL_TRADING_ALLOWED,
    process.env.VT_MARKETS_SERVER,
    process.env.VT_MARKETS_LOGIN,
    process.env.MT5_BRIDGE_URL,
    checkBridgeEnv().valid ? 'bridge-env-valid' : 'bridge-env-invalid',
  ].join('|')
}

export function isReadOnly() {
  return boolEnv('VT_MARKETS_READ_ONLY', true)
}

export function safetyCheck(account?: Mt5AccountInfo) {
  const safety = getSafetyConfig()
  const warnings: string[] = []
  const bridgeEnv = checkBridgeEnv()
  const mode = envValue('VT_MARKETS_MODE') || 'DEMO'
  const credentialsMissing = !bridgeEnv.valid
    && (!envValue('VT_MARKETS_SERVER') || !envValue('VT_MARKETS_LOGIN') || (!envValue('VT_MARKETS_PASSWORD') && !envValue('VT_MARKETS_INVESTOR_PASSWORD')))

  if (mode !== 'DEMO') warnings.push(`VT_MARKETS_MODE=${mode} bloqueado; solo DEMO permitido.`)
  if (safety.vtMarketsRealTradingAllowed) warnings.push('VT_MARKETS_REAL_TRADING_ALLOWED=true bloqueado por seguridad.')
  if (safety.vtMarketsAllowOrderSend) warnings.push('VT_MARKETS_ALLOW_ORDER_SEND=true bloqueado en fase read-only.')
  if (!isReadOnly()) warnings.push('VT_MARKETS_READ_ONLY=false bloqueado; esta fase es solo lectura.')
  if (account?.accountMode === 'REAL') warnings.push('Cuenta real detectada: KillSwitch debe bloquear.')
  if (configured() && credentialsMissing) warnings.push('VT Markets demo habilitado pero faltan credenciales.')

  const blocked = mode !== 'DEMO'
    || safety.vtMarketsRealTradingAllowed
    || safety.vtMarketsAllowOrderSend
    || !isReadOnly()
    || account?.accountMode === 'REAL'

  return {
    blocked,
    credentialsMissing,
    warnings,
  }
}

export async function getStatus(): Promise<VtMarketsStatus> {
  const cacheKey = statusCacheKey()
  if (statusCache && statusCache.key === cacheKey && Date.now() - statusCache.at < 2_000) return statusCache.value
  const enabled = configured()
  const bridge = enabled ? await getMt5Status() : null
  const account = enabled && bridge?.connected ? await getMt5Account() : undefined
  const check = safetyCheck(account)
  const bridgeEnv = checkBridgeEnv()
  const server = envValue('VT_MARKETS_SERVER') || bridgeEnv.server || ''
  const loginMasked = maskLogin(envValue('VT_MARKETS_LOGIN')) || bridgeEnv.loginMasked || ''
  const base = {
    accountType: account?.accountMode === 'REAL' ? 'REAL_BLOCKED' as const : account?.accountMode === 'DEMO' ? 'MT5_DEMO' as const : 'UNKNOWN' as const,
    broker: 'VT Markets' as const,
    connected: false,
    enabled,
    loginMasked,
    mode: 'DEMO' as const,
    orderSendAllowed: false as const,
    platform: 'MT5' as const,
    readOnly: true as const,
    realTradingAllowed: false as const,
    server,
    warnings: check.warnings,
  }

  if (!enabled || check.credentialsMissing) {
    const value: VtMarketsStatus = {
      ...base,
      status: 'NOT_CONFIGURED',
      warnings: [...check.warnings, enabled ? 'VT Markets demo configurado parcialmente; esperando credenciales completas.' : 'VT Markets no configurado.'],
    }
    statusCache = { at: Date.now(), key: cacheKey, value }
    return value
  }

  if (check.blocked) {
    const value: VtMarketsStatus = {
      ...base,
      status: 'BLOCKED_BY_SAFETY',
      warnings: [...check.warnings, 'Order send bloqueado en esta fase.'],
    }
    statusCache = { at: Date.now(), key: cacheKey, value }
    return value
  }

  if (!bridge || bridge.status !== 'CONNECTED') {
    const value: VtMarketsStatus = {
      ...base,
      status: bridge?.status === 'ERROR' ? 'ERROR' : 'CONFIGURED_BUT_DISCONNECTED',
      warnings: [...check.warnings, 'VT Markets demo configurado, esperando conexion MT5.'],
    }
    statusCache = { at: Date.now(), key: cacheKey, value }
    return value
  }

  const value: VtMarketsStatus = {
    ...base,
    connected: true,
    status: 'CONNECTED_DEMO_READ_ONLY',
    warnings: [...check.warnings, 'VT Markets demo conectado en modo solo lectura.', 'Order send bloqueado en esta fase.'],
  }
  statusCache = { at: Date.now(), key: cacheKey, value }
  return value
}

export async function getAccount() {
  const status = await getStatus()
  const account = status.connected ? await getMt5Account() : null
  return {
    accountMode: account?.accountMode ?? 'UNKNOWN',
    balance: account?.balance ?? null,
    equity: account?.equity ?? null,
    freeMargin: account?.freeMargin ?? null,
    login: account?.login ? maskLogin(account.login) : status.loginMasked,
    marginLevel: account?.marginLevel ?? null,
    server: account?.server ?? status.server,
    usedMargin: account?.usedMargin ?? null,
    status: status.status,
  }
}

export async function getSymbols() {
  if (symbolsCache && Date.now() - symbolsCache.at < 30_000) return symbolsCache.value
  const status = await getStatus()
  if (!status.connected) return []
  const symbols = await getMt5Symbols()
  symbolsCache = { at: Date.now(), value: symbols }
  return symbols
}

export async function getTick(symbol: string) {
  const status = await getStatus()
  if (!status.connected) return null
  return getMt5Tick(symbol)
}

export async function getPositions() {
  const status = await getStatus()
  if (!status.connected) return []
  return getMt5Positions()
}

export async function isDemoAccount() {
  const account = await getAccount()
  return account.accountMode === 'DEMO'
}

export const getVtMarketsStatus = getStatus
