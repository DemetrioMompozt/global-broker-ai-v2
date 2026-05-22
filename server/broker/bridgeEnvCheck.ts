import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export type BridgeEnvCheck = {
  exists: boolean
  loginMasked?: string
  valid: boolean
  missingVariables: string[]
  server?: string
  unsafeVariables: string[]
  presentVariables: string[]
  message: string
}

export type SaveBridgeEnvInput = {
  login: string
  password: string
  server: string
}

export type SaveBridgeEnvResponse = {
  ok: true
  envCreated: true
  path: string
  server: string
  loginMasked: string
  safety: {
    MT5_MODE: 'DEMO'
    MT5_READ_ONLY: true
    MT5_ALLOW_ORDER_SEND: false
    MT5_REAL_TRADING_ALLOWED: false
  }
  nextAction: string
}

const requiredVariables = [
  'MT5_MODE',
  'MT5_SERVER',
  'MT5_LOGIN',
  'MT5_PASSWORD',
  'MT5_READ_ONLY',
  'MT5_ALLOW_ORDER_SEND',
  'MT5_REAL_TRADING_ALLOWED',
  'MT5_HOST',
  'MT5_PORT',
]

export function bridgeEnvPath() {
  return process.env.MT5_BRIDGE_ENV_PATH || path.resolve(process.cwd(), 'mt5-bridge', '.env')
}

function relativeBridgeEnvPath(filePath: string) {
  const relative = path.relative(process.cwd(), filePath)
  return relative.startsWith('..') ? filePath : relative.replace(/\\/g, '/')
}

export function parseBridgeEnvFile(filePath: string) {
  const values = new Map<string, string>()
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    values.set(trimmed.slice(0, index).trim(), trimmed.slice(index + 1).trim())
  }
  return values
}

function maskLogin(login: string) {
  if (!login) return ''
  if (login.length <= 4) return `****${login.slice(-1)}`
  return `****${login.slice(-4)}`
}

export function checkBridgeEnv(filePath = bridgeEnvPath()): BridgeEnvCheck {
  if (!existsSync(filePath)) {
    return {
      exists: false,
      valid: false,
      missingVariables: requiredVariables,
      server: '',
      loginMasked: '',
      presentVariables: [],
      unsafeVariables: [],
      message: 'Crea el archivo global-broker-ai-v2/mt5-bridge/.env con tus datos demo.',
    }
  }

  const values = parseBridgeEnvFile(filePath)
  const missingVariables = requiredVariables.filter((key) => !values.has(key) || values.get(key) === '')
  const unsafeVariables: string[] = []

  if ((values.get('MT5_MODE') ?? '').toUpperCase() !== 'DEMO') unsafeVariables.push('MT5_MODE must be DEMO')
  if ((values.get('MT5_READ_ONLY') ?? '').toLowerCase() !== 'true') unsafeVariables.push('MT5_READ_ONLY must be true')
  if ((values.get('MT5_ALLOW_ORDER_SEND') ?? '').toLowerCase() !== 'false') unsafeVariables.push('MT5_ALLOW_ORDER_SEND must be false')
  if ((values.get('MT5_REAL_TRADING_ALLOWED') ?? '').toLowerCase() !== 'false') unsafeVariables.push('MT5_REAL_TRADING_ALLOWED must be false')

  const valid = missingVariables.length === 0 && unsafeVariables.length === 0
  return {
    exists: true,
    valid,
    missingVariables,
    server: values.get('MT5_SERVER') ?? '',
    loginMasked: maskLogin(values.get('MT5_LOGIN') ?? ''),
    presentVariables: requiredVariables.filter((key) => values.has(key) && values.get(key) !== '').filter((key) => key !== 'MT5_PASSWORD'),
    unsafeVariables,
    message: valid ? '.env listo para ejecutar el bridge en modo DEMO read-only.' : 'Faltan variables o hay valores inseguros en mt5-bridge/.env.',
  }
}

function requireSafeValue(name: string, value: unknown) {
  if (typeof value !== 'string') throw new Error(`${name} es requerido.`)
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${name} es requerido.`)
  if (/[\r\n]/.test(value)) throw new Error(`${name} no puede contener saltos de linea.`)
  return trimmed
}

export function saveBridgeEnv(input: SaveBridgeEnvInput, filePath = bridgeEnvPath()): SaveBridgeEnvResponse {
  const server = requireSafeValue('server', input.server)
  const login = requireSafeValue('login', input.login)
  const password = requireSafeValue('password', input.password)
  const content = [
    'MT5_MODE=DEMO',
    `MT5_SERVER=${server}`,
    `MT5_LOGIN=${login}`,
    `MT5_PASSWORD=${password}`,
    'MT5_READ_ONLY=true',
    'MT5_ALLOW_ORDER_SEND=false',
    'MT5_REAL_TRADING_ALLOWED=false',
    'MT5_HOST=127.0.0.1',
    'MT5_PORT=5190',
    '',
  ].join('\n')

  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, content, { encoding: 'utf8', flag: 'w' })

  return {
    ok: true,
    envCreated: true,
    path: relativeBridgeEnvPath(filePath),
    server,
    loginMasked: maskLogin(login),
    safety: {
      MT5_MODE: 'DEMO',
      MT5_READ_ONLY: true,
      MT5_ALLOW_ORDER_SEND: false,
      MT5_REAL_TRADING_ALLOWED: false,
    },
    nextAction: 'Ejecuta mt5_bridge.py',
  }
}
