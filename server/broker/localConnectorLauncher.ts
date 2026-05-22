import { existsSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { probeMt5Bridge } from './mt5Bridge.js'

export type ConnectorLaunchResult = {
  attempted: boolean
  bridgeReachable: boolean
  detail?: string
  message: string
  pid?: number
  started: boolean
}

let runningPid: number | null = null

function bridgeDir() {
  return path.resolve(process.cwd(), 'mt5-bridge')
}

function logsDir() {
  return path.resolve(process.cwd(), 'logs')
}

function commandForPlatform() {
  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/c', 'python -m pip install -r requirements.txt && python mt5_bridge.py'],
    }
  }
  return {
    command: '/bin/sh',
    args: ['-lc', 'python3 -m pip install -r requirements.txt && python3 mt5_bridge.py'],
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function tail(filePath: string, max = 900) {
  try {
    if (!existsSync(filePath)) return ''
    const content = readFileSync(filePath, 'utf8').trim()
    return content.length > max ? content.slice(-max) : content
  } catch {
    return ''
  }
}

function simpleFailureMessage(stdoutPath: string, stderrPath: string) {
  const logs = `${tail(stdoutPath)}\n${tail(stderrPath)}`.trim()
  if (!logs) return 'El conector local todavia no responde.'
  if (logs.includes('No matching distribution found for MetaTrader5')) {
    return 'No se pudieron instalar las dependencias del conector. Actualiza las dependencias e intenta de nuevo.'
  }
  if (logs.includes('MetaTrader5 Python package is not available')) {
    return 'Falta instalar el paquete MetaTrader5 para Python.'
  }
  if (logs.toLowerCase().includes('address already in use')) {
    return 'El puerto del conector ya esta ocupado. Puede que el conector este abriendose.'
  }
  return 'El conector local intento iniciar, pero no logro responder todavia.'
}

export async function ensureLocalConnectorRunning(): Promise<ConnectorLaunchResult> {
  const before = await probeMt5Bridge('/mt5/status', 800)
  if (before.reachable) {
    return {
      attempted: false,
      bridgeReachable: true,
      message: 'El conector local ya esta activo.',
      started: false,
    }
  }

  if (process.env.MT5_CONNECTOR_DRY_RUN === 'true') {
    return {
      attempted: true,
      bridgeReachable: false,
      message: 'Dry run: se simulo el inicio del conector local.',
      started: true,
    }
  }

  const cwd = bridgeDir()
  if (!existsSync(path.join(cwd, 'mt5_bridge.py'))) {
    return {
      attempted: false,
      bridgeReachable: false,
      message: 'No se encontro el conector local instalado.',
      started: false,
    }
  }

  mkdirSync(logsDir(), { recursive: true })
  const stdoutPath = path.join(logsDir(), 'mt5-connector.log')
  const stderrPath = path.join(logsDir(), 'mt5-connector-error.log')
  const out = openSync(stdoutPath, 'a')
  const err = openSync(stderrPath, 'a')
  const { command, args } = commandForPlatform()
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: ['ignore', out, err],
    windowsHide: true,
  })
  runningPid = child.pid ?? null
  child.unref()

  for (let index = 0; index < 15; index += 1) {
    await wait(1000)
    const probe = await probeMt5Bridge('/mt5/status', 900)
    if (probe.reachable) {
      return {
        attempted: true,
        bridgeReachable: true,
        message: 'Conector local iniciado.',
        pid: runningPid ?? undefined,
        started: true,
      }
    }
  }

  return {
    attempted: true,
    bridgeReachable: false,
    detail: `${tail(stdoutPath)}\n${tail(stderrPath)}`.trim(),
    message: simpleFailureMessage(stdoutPath, stderrPath),
    pid: runningPid ?? undefined,
    started: true,
  }
}
