import { Router } from 'express'
import { checkBridgeEnv, saveBridgeEnv } from '../broker/bridgeEnvCheck.js'
import { connectVtMarketsDemo } from '../broker/vtMarketsConnectionWizard.js'
import { getMt5BridgePlan, probeMt5Bridge } from '../broker/mt5Bridge.js'
import { getAccount, getPositions, getStatus, getSymbols } from '../broker/vtMarketsConnector.js'
import { getVtMarketsCfdPrice } from '../feeds/vtMarketsPriceProvider.js'
import { getSafetyConfig } from '../config/safetyConfig.js'
import { getKillSwitchStatus } from '../risk/killSwitch.js'
import { mapVtMarketsSymbol } from '../symbols/vtMarketsSymbolMapper.js'

export const vtMarketsRouter = Router()

const defaultInternalSymbols = ['BTCUSD.cfd', 'ETHUSD.cfd', 'NAS100.cfd', 'US500.cfd', 'US30.cfd', 'XAUUSD.cfd', 'EURUSD.cfd', 'GBPUSD.cfd', 'USDJPY.cfd']

vtMarketsRouter.get('/status', async (_request, response) => {
  response.json({
    ...(await getStatus()),
    bridge: getMt5BridgePlan(),
  })
})

vtMarketsRouter.get('/account', async (_request, response) => {
  response.json(await getAccount())
})

vtMarketsRouter.get('/symbols', async (_request, response) => {
  response.json({
    symbols: await getSymbols(),
    status: (await getStatus()).status,
  })
})

vtMarketsRouter.get('/mapping', async (_request, response) => {
  const symbols = await getSymbols()
  response.json({
    mappings: defaultInternalSymbols.map((symbol) => mapVtMarketsSymbol(symbol, symbols)),
    note: symbols.length ? 'Mapping calculado contra simbolos disponibles en MT5 demo.' : 'Sin MT5 demo conectado, el mapper muestra candidatos pero no asume nombres reales.',
  })
})

vtMarketsRouter.get('/tick', async (request, response) => {
  const symbol = String(request.query.symbol ?? 'NAS100.cfd')
  const price = await getVtMarketsCfdPrice(symbol)
  if (!price) {
    response.status(503).json({
      cfdSymbol: symbol,
      status: (await getStatus()).status,
      reason: 'VT Markets demo read-only no esta conectado o el simbolo no existe.',
    })
    return
  }
  response.json(price)
})

vtMarketsRouter.get('/positions', async (_request, response) => {
  response.json({
    positions: await getPositions(),
    status: (await getStatus()).status,
  })
})

vtMarketsRouter.get('/bridge-env-check', (_request, response) => {
  response.json(checkBridgeEnv())
})

vtMarketsRouter.post('/save-bridge-env', (request, response) => {
  try {
    const body = request.body as { login?: unknown; password?: unknown; server?: unknown }
    response.json(saveBridgeEnv({
      login: String(body.login ?? ''),
      password: String(body.password ?? ''),
      server: String(body.server ?? ''),
    }))
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo guardar mt5-bridge/.env.',
    })
  }
})

vtMarketsRouter.post('/connect-demo', async (request, response) => {
  try {
    const body = request.body as { login?: unknown; password?: unknown; server?: unknown }
    response.json(await connectVtMarketsDemo({
      login: String(body.login ?? ''),
      password: String(body.password ?? ''),
      server: String(body.server ?? ''),
    }))
  } catch (error) {
    response.status(400).json({
      status: 'ERROR',
      userMessage: error instanceof Error ? error.message : 'No se pudo conectar VT Markets demo.',
      safety: {
        paperOnly: true,
        realTradingAllowed: false,
        brokerExecutionEnabled: false,
        orderSendAllowed: false,
        readOnly: true,
      },
    })
  }
})

vtMarketsRouter.get('/setup-diagnostics', async (_request, response) => {
  const envCheck = checkBridgeEnv()
  const bridge = await probeMt5Bridge('/mt5/status')
  const vtStatus = await getStatus()
  const account = await getAccount()
  const safety = getSafetyConfig()
  const killSwitch = getKillSwitchStatus()
  const bridgeStatus = bridge.reachable
    ? bridge.ok
      ? 'CONNECTED'
      : 'DISCONNECTED'
    : 'ERROR'
  const accountType = vtStatus.accountType === 'REAL_BLOCKED'
    ? 'REAL_BLOCKED'
    : account.accountMode === 'DEMO'
      ? 'DEMO'
      : 'UNKNOWN'
  const safetyBlocked = vtStatus.status === 'BLOCKED_BY_SAFETY' || envCheck.unsafeVariables.length > 0
  const steps = [
    {
      id: 'mt5_terminal',
      label: 'Abre MetaTrader 5',
      status: bridge.reachable ? 'completed' : 'pending',
      message: bridge.reachable ? 'Bridge alcanzo el terminal/servicio MT5.' : 'Pendiente: abre MT5 y ejecuta el bridge local.',
    },
    {
      id: 'demo_login',
      label: 'Inicia sesion en demo VT Markets',
      status: accountType === 'REAL_BLOCKED' ? 'blocked' : accountType === 'DEMO' ? 'completed' : 'pending',
      message: accountType === 'REAL_BLOCKED'
        ? 'Cuenta real detectada. KillSwitch activado.'
        : accountType === 'DEMO'
          ? 'Cuenta demo detectada.'
          : 'Pendiente: /mt5/account aun no confirma cuenta demo.',
    },
    {
      id: 'env_file',
      label: 'Configura .env del bridge',
      status: envCheck.valid ? 'completed' : envCheck.unsafeVariables.length ? 'error' : 'pending',
      message: envCheck.message,
      missingVariables: envCheck.missingVariables,
      unsafeVariables: envCheck.unsafeVariables,
    },
    {
      id: 'bridge_running',
      label: 'Ejecuta el bridge local',
      status: bridge.reachable && bridge.ok ? 'completed' : bridge.reachable ? 'error' : 'pending',
      message: bridge.reachable ? 'Bridge responde en 127.0.0.1:5190.' : 'Bridge no responde en 127.0.0.1:5190.',
    },
    {
      id: 'read_only_safety',
      label: 'Validacion de seguridad',
      status: safetyBlocked ? 'blocked' : 'completed',
      message: safetyBlocked ? 'Configuracion insegura bloqueada.' : 'Read-only confirmado. Order send y trading real desactivados.',
    },
    {
      id: 'verify_connection',
      label: 'Verifica conexion',
      status: vtStatus.status === 'CONNECTED_DEMO_READ_ONLY' ? 'completed' : safetyBlocked ? 'blocked' : 'pending',
      message: vtStatus.status === 'CONNECTED_DEMO_READ_ONLY' ? 'VT Markets demo conectado en modo solo lectura.' : 'Pendiente: aun no hay conexion demo read-only completa.',
    },
  ]

  let nextAction = 'Ejecuta mt5_bridge.py.'
  if (!envCheck.exists) nextAction = 'Crea mt5-bridge/.env con tus datos demo.'
  else if (!envCheck.valid) nextAction = envCheck.unsafeVariables.length ? 'Corrige variables inseguras en mt5-bridge/.env.' : `Faltan variables: ${envCheck.missingVariables.join(', ')}.`
  else if (vtStatus.status === 'NOT_CONFIGURED') nextAction = 'Guarda la configuracion demo MT5 y luego ejecuta el bridge local.'
  if (bridge.reachable && !bridge.ok) nextAction = 'Bridge activo, pero MT5 no tiene sesion demo conectada.'
  if (vtStatus.status === 'CONFIGURED_BUT_DISCONNECTED') nextAction = 'Abre MT5 e inicia sesion en cuenta demo de VT Markets.'
  if (vtStatus.status === 'CONNECTED_DEMO_READ_ONLY') nextAction = 'Conexion demo lista en modo solo lectura.'
  if (vtStatus.status === 'BLOCKED_BY_SAFETY') nextAction = 'Cuenta real o configuracion peligrosa detectada. KillSwitch activo.'

  response.json({
    steps,
    bridgeEnv: envCheck,
    mt5Bridge: {
      url: bridge.url,
      reachable: bridge.reachable,
      status: bridgeStatus,
      httpStatus: bridge.httpStatus,
      raw: bridge.body,
    },
    vtMarkets: {
      enabled: vtStatus.enabled,
      configured: vtStatus.enabled && Boolean(vtStatus.server && vtStatus.loginMasked),
      mode: 'DEMO',
      readOnly: true,
      connected: vtStatus.status === 'CONNECTED_DEMO_READ_ONLY',
      accountType,
      status: vtStatus.status,
      account,
    },
    safety: {
      paperOnly: true,
      realTradingAllowed: false,
      brokerExecutionEnabled: false,
      orderSendAllowed: false,
      readOnly: true,
      killSwitchStatus: vtStatus.status === 'BLOCKED_BY_SAFETY' ? 'TRIGGERED' : killSwitch.status,
      raw: safety,
    },
    nextAction,
  })
})

vtMarketsRouter.post('/order-check-demo', (_request, response) => {
  response.status(403).json({
    ok: false,
    status: 'BLOCKED_READ_ONLY',
    reason: 'Order check/envio demo queda bloqueado en esta fase read-only.',
    realTradingAllowed: false,
    orderSendAllowed: false,
  })
})
