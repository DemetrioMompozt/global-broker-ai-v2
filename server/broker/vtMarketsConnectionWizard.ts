import { checkBridgeEnv, saveBridgeEnv } from './bridgeEnvCheck.js'
import { ensureLocalConnectorRunning } from './localConnectorLauncher.js'
import { probeMt5Bridge } from './mt5Bridge.js'
import { getAccount, getStatus, getSymbols } from './vtMarketsConnector.js'
import { getVtMarketsCfdPrice } from '../feeds/vtMarketsPriceProvider.js'
import { getKillSwitchStatus } from '../risk/killSwitch.js'

export type VtMarketsWizardStatus =
  | 'BLOCKED_REAL_ACCOUNT'
  | 'CONNECTED_DEMO_READ_ONLY'
  | 'ERROR'
  | 'INVALID_CREDENTIALS'
  | 'NEEDS_CONNECTOR'
  | 'NEEDS_MT5_LOGIN'

export type ConnectVtMarketsDemoInput = {
  login?: string
  password?: string
  server?: string
}

export async function connectVtMarketsDemo(input: ConnectVtMarketsDemoInput) {
  const existingEnv = checkBridgeEnv()
  const hasNewCredentials = Boolean(input.login?.trim() && input.password?.trim() && input.server?.trim())
  const saved = hasNewCredentials
    ? saveBridgeEnv({
      login: input.login ?? '',
      password: input.password ?? '',
      server: input.server ?? '',
    })
    : null
  const envCheck = checkBridgeEnv()
  const connector = envCheck.valid ? await ensureLocalConnectorRunning() : null
  const bridge = await probeMt5Bridge('/mt5/status')
  const status = await getStatus()
  const account = await getAccount()
  const symbols = await getSymbols()
  const testTick = await getVtMarketsCfdPrice('NAS100.cfd')
  const killSwitch = getKillSwitchStatus()

  let wizardStatus: VtMarketsWizardStatus = 'ERROR'
  let userMessage = 'No pudimos completar la conexion. Revisa los datos demo e intenta de nuevo.'

  if (status.status === 'BLOCKED_BY_SAFETY' || account.accountMode === 'REAL' || killSwitch.status === 'TRIGGERED') {
    wizardStatus = 'BLOCKED_REAL_ACCOUNT'
    userMessage = 'Cuenta real o configuracion insegura detectada. Por seguridad la conexion fue bloqueada.'
  } else if (!envCheck.valid || (!hasNewCredentials && !existingEnv.valid)) {
    wizardStatus = 'INVALID_CREDENTIALS'
    userMessage = 'Falta configurar una cuenta demo de VT Markets. Ingresa servidor, login demo y password demo una sola vez.'
  } else if (!bridge.reachable) {
    wizardStatus = 'NEEDS_CONNECTOR'
    userMessage = connector?.attempted
      ? `No conectado: ${connector.message}`
      : 'El conector local no esta activo.'
  } else if (!bridge.ok || status.status === 'CONFIGURED_BUT_DISCONNECTED') {
    wizardStatus = 'NEEDS_MT5_LOGIN'
    userMessage = 'Abre MetaTrader 5 e inicia sesion en tu cuenta demo de VT Markets.'
  } else if (status.status === 'CONNECTED_DEMO_READ_ONLY' && account.accountMode === 'DEMO') {
    wizardStatus = 'CONNECTED_DEMO_READ_ONLY'
    userMessage = 'VT Markets demo conectado correctamente en modo seguro.'
  }

  return {
    status: wizardStatus,
    userMessage,
    account,
    safety: {
      paperOnly: true,
      realTradingAllowed: false,
      brokerExecutionEnabled: false,
      orderSendAllowed: false,
      readOnly: true,
      killSwitchStatus: killSwitch.status,
    },
    technical: {
      saved,
      connector,
      envCheck,
      bridge,
      vtStatus: status,
      symbolsCount: symbols.length,
      testTick,
    },
  }
}
