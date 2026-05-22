import { type FormEvent, useEffect, useRef, useState } from 'react'
import { connectVtMarketsDemo, fetchBridgeEnvCheck, fetchVtAccount, fetchVtMapping, fetchVtSetupDiagnostics, fetchVtSymbols, fetchVtTick } from '../../api/client'
import type { BridgeEnvCheck, CfdPaperStatus, VtAccount, VtMappingResponse, VtMarketsConnectionWizardResult, VtSetupDiagnostics, VtSymbolsResponse, VtTickResponse } from '../../types/trading'
import { StatusPill } from '../shared/StatusPill'

const bridgeCommands = `cd global-broker-ai-v2/mt5-bridge
python -m pip install -r requirements.txt
python mt5_bridge.py`

const envTemplate = `MT5_MODE=DEMO
MT5_SERVER=TU_SERVIDOR_DE_VT_MARKETS
MT5_LOGIN=TU_LOGIN_DEMO
MT5_PASSWORD=TU_PASSWORD_DEMO
MT5_READ_ONLY=true
MT5_ALLOW_ORDER_SEND=false
MT5_REAL_TRADING_ALLOWED=false
MT5_HOST=127.0.0.1
MT5_PORT=5190`

function simpleStatus(vt: CfdPaperStatus['vtMarkets'], result: VtMarketsConnectionWizardResult | null) {
  if (result?.status === 'CONNECTED_DEMO_READ_ONLY' || vt.status === 'CONNECTED_DEMO_READ_ONLY') return 'Conectado demo'
  if (result?.status === 'NEEDS_CONNECTOR') return 'Esperando conector'
  if (result?.status === 'NEEDS_MT5_LOGIN') return 'Esperando MT5'
  if (result?.status === 'BLOCKED_REAL_ACCOUNT' || vt.status === 'BLOCKED_BY_SAFETY') return 'Bloqueado por seguridad'
  if (result?.status === 'ERROR' || vt.status === 'ERROR') return 'Error de conexion'
  if (result) return 'Configurando'
  return vt.enabled ? 'Conectando' : 'No conectado'
}

function userMessage(vt: CfdPaperStatus['vtMarkets'], result: VtMarketsConnectionWizardResult | null) {
  if (result?.userMessage) return result.userMessage
  if (vt.status === 'CONNECTED_DEMO_READ_ONLY') return 'VT Markets demo conectado en modo seguro.'
  if (vt.status === 'BLOCKED_BY_SAFETY') return 'Cuenta real o configuracion insegura detectada. Por seguridad la conexion fue bloqueada.'
  return 'Conecta tu cuenta demo MT5 de VT Markets para usar precios y condiciones reales del broker en modo solo lectura.'
}

function SimpleAccount({ account, symbolsCount, feed }: { account: VtAccount | CfdPaperStatus['vtMarkets']['account']; feed?: string | null; symbolsCount?: number }) {
  return (
    <div className="position-metrics">
      <span>Cuenta demo: <strong>{'login' in account && account.login ? account.login : '-'}</strong></span>
      <span>Balance: <strong>{account.balance ?? '-'}</strong></span>
      <span>Equity: <strong>{account.equity ?? '-'}</strong></span>
      <span>Free Margin: <strong>{account.freeMargin ?? '-'}</strong></span>
      <span>Used Margin: <strong>{account.usedMargin ?? '-'}</strong></span>
      <span>Margin Level: <strong>{account.marginLevel ?? '-'}</strong></span>
      <span>Simbolos: <strong>{symbolsCount ?? '-'}</strong></span>
      <span>Feed: <strong>{feed ?? 'MT5 Demo'}</strong></span>
    </div>
  )
}

export function VTMarketsReadiness({ vt }: { vt: CfdPaperStatus['vtMarkets'] }) {
  const [serverInput, setServerInput] = useState('')
  const [loginInput, setLoginInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [wizardResult, setWizardResult] = useState<VtMarketsConnectionWizardResult | null>(null)
  const [diagnostics, setDiagnostics] = useState<VtSetupDiagnostics | null>(null)
  const [envProbe, setEnvProbe] = useState<BridgeEnvCheck | null>(null)
  const [accountProbe, setAccountProbe] = useState<VtAccount | null>(null)
  const [symbolsProbe, setSymbolsProbe] = useState<VtSymbolsResponse | null>(null)
  const [mappingProbe, setMappingProbe] = useState<VtMappingResponse | null>(null)
  const [tickProbe, setTickProbe] = useState<VtTickResponse | null>(null)
  const [advancedMessage, setAdvancedMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const autoConnectAttempted = useRef(false)

  const status = simpleStatus(vt, wizardResult)
  const blocked = status === 'Bloqueado por seguridad'
  const connected = status === 'Conectado demo'
  const account = accountProbe ?? wizardResult?.account ?? vt.account
  const symbolsCount = symbolsProbe?.symbols.length ?? wizardResult?.technical.symbolsCount ?? vt.symbolsMapped
  const feed = wizardResult?.technical.testTick?.feedType ?? tickProbe?.feedType ?? (connected ? 'BROKER_DEMO_REALTIME' : null)
  const hasSavedDemoConfig = envProbe?.valid || vt.enabled

  useEffect(() => {
    let cancelled = false
    async function bootConnect() {
      try {
        const env = await fetchBridgeEnvCheck()
        if (cancelled) return
        setEnvProbe(env)
        if (env.valid && !autoConnectAttempted.current) {
          autoConnectAttempted.current = true
          const result = await connectVtMarketsDemo({})
          if (!cancelled) setWizardResult(result)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    void bootConnect()
    return () => {
      cancelled = true
    }
  }, [])

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      const result = hasSavedDemoConfig
        ? await connectVtMarketsDemo({})
        : await connectVtMarketsDemo({
          login: loginInput,
          password: passwordInput,
          server: serverInput,
        })
      setWizardResult(result)
      setPasswordInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function runAdvancedCheck() {
    setError(null)
    try {
      const [nextEnv, nextDiagnostics, nextAccount, nextSymbols] = await Promise.all([
        fetchBridgeEnvCheck(),
        fetchVtSetupDiagnostics(),
        fetchVtAccount(),
        fetchVtSymbols(),
      ])
      setEnvProbe(nextEnv)
      setDiagnostics(nextDiagnostics)
      setAccountProbe(nextAccount)
      setSymbolsProbe(nextSymbols)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function copyCommands() {
    setError(null)
    setAdvancedMessage(null)
    try {
      await navigator.clipboard.writeText(bridgeCommands)
      setAdvancedMessage('Comandos copiados para diagnostico avanzado.')
    } catch {
      setError('No pude copiar automaticamente. Puedes seleccionar y copiar desde Diagnostico avanzado.')
    }
  }

  async function runMapping() {
    setError(null)
    try {
      setMappingProbe(await fetchVtMapping())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function runTick() {
    setError(null)
    try {
      setTickProbe(await fetchVtTick('NAS100.cfd'))
    } catch (err) {
      setTickProbe({ reason: err instanceof Error ? err.message : String(err), status: 'ERROR' })
    }
  }

  return (
    <section className="panel vt-simple">
      <div className="vt-heading">
        <div>
          <div className="eyebrow">VT Markets</div>
          <h3>VT Markets Demo</h3>
          <p className="muted">Conecta una cuenta demo MT5 para leer precios, simbolos, margen y balance.</p>
        </div>
        <StatusPill label={status} ok={connected} />
      </div>

      <p className={blocked ? 'warning' : 'reason'}>{userMessage(vt, wizardResult)}</p>

      <form className={`demo-config-form ${hasSavedDemoConfig ? 'saved-connect-form' : 'simple-connect-form'}`} onSubmit={(event) => void connect(event)}>
        {hasSavedDemoConfig ? (
          <div className="saved-demo-config">
            <span>Cuenta demo guardada</span>
            <strong>{envProbe?.server || vt.server || 'VT Markets Demo'} · {envProbe?.loginMasked || vt.loginMasked || 'login demo'}</strong>
            <small>La app usa la configuracion guardada sin mostrar el password.</small>
          </div>
        ) : (
          <>
            <label>
              Servidor
              <input value={serverInput} onChange={(event) => setServerInput(event.target.value)} placeholder="Servidor demo de VT Markets" autoComplete="off" />
            </label>
            <label>
              Login demo
              <input value={loginInput} onChange={(event) => setLoginInput(event.target.value)} placeholder="Login demo" autoComplete="off" inputMode="numeric" />
            </label>
            <label>
              Password demo
              <input value={passwordInput} onChange={(event) => setPasswordInput(event.target.value)} placeholder="Password demo" type="password" autoComplete="off" />
            </label>
          </>
        )}
        <button type="submit">{hasSavedDemoConfig ? 'Conectar ahora' : 'Conectar'}</button>
      </form>

      <div className="readiness simple-safety">
        <StatusPill label="Modo: Demo" ok />
        <StatusPill label="Lectura: Solo lectura" ok />
        <StatusPill label="Ordenes: Bloqueadas" ok />
        <StatusPill label="Dinero real: Desactivado" ok />
      </div>

      {wizardResult?.status === 'NEEDS_CONNECTOR' ? (
        <div className="connector-hint">
          <p>{wizardResult.userMessage}</p>
        </div>
      ) : null}

      {connected || accountProbe || wizardResult ? (
        <SimpleAccount account={account} symbolsCount={symbolsCount} feed={feed} />
      ) : null}

      {error ? <p className="warning">{error}</p> : null}

      <details className="advanced-diagnostics">
        <summary>Ver diagnostico avanzado</summary>
        <div className="hero-actions">
          <button className="secondary" onClick={() => void runAdvancedCheck()}>Verificar MT5 Bridge</button>
          <button className="secondary" onClick={() => void fetchBridgeEnvCheck().then(setEnvProbe).catch((err) => setError(String(err)))}>Validar .env</button>
          <button className="secondary" onClick={() => void copyCommands()}>Copiar comandos para ejecutar bridge</button>
          <button className="secondary" onClick={() => void fetchVtSymbols().then(setSymbolsProbe).catch((err) => setError(String(err)))}>Buscar simbolos VT Markets</button>
          <button className="secondary" onClick={() => void runMapping()}>Probar mapping CFD</button>
          <button className="secondary" onClick={() => void runTick()}>Probar precio VT</button>
        </div>

        {diagnostics ? (
          <div className="position-metrics">
            <span>Bridge running: <strong>{diagnostics.mt5Bridge.reachable ? 'yes' : 'no'}</strong></span>
            <span>MT5 connected: <strong>{diagnostics.vtMarkets.connected ? 'yes' : 'no'}</strong></span>
            <span>Mode: <strong>{diagnostics.vtMarkets.mode}</strong></span>
            <span>Read only: <strong>{String(diagnostics.vtMarkets.readOnly)}</strong></span>
            <span>Order send: <strong>{String(diagnostics.safety.orderSendAllowed)}</strong></span>
            <span>Real trading: <strong>{String(diagnostics.safety.realTradingAllowed)}</strong></span>
            <span>KillSwitch: <strong>{diagnostics.safety.killSwitchStatus}</strong></span>
            <span>Next: <strong>{diagnostics.nextAction}</strong></span>
          </div>
        ) : null}

        {envProbe ? (
          <div className="position-metrics">
            <span>.env encontrado: <strong>{envProbe.exists ? 'si' : 'no'}</strong></span>
            <span>.env valido: <strong>{envProbe.valid ? 'si' : 'no'}</strong></span>
            <span>Server: <strong>{envProbe.server || '-'}</strong></span>
            <span>Login: <strong>{envProbe.loginMasked || '-'}</strong></span>
            <span>Faltantes: <strong>{envProbe.missingVariables.length ? envProbe.missingVariables.join(', ') : '-'}</strong></span>
            <span>Inseguras: <strong>{envProbe.unsafeVariables.length ? envProbe.unsafeVariables.join(', ') : '-'}</strong></span>
            <span>Listo para bridge: <strong>{envProbe.valid ? 'si' : 'no'}</strong></span>
            <span>Mensaje: <strong>{envProbe.message}</strong></span>
          </div>
        ) : null}

        {mappingProbe ? (
          <div className="table compact">
            <div className="row head"><span>Interno</span><span>Broker</span><span>Status</span><span>Candidatos</span></div>
            {mappingProbe.mappings.map((mapping) => (
              <div className="row" key={mapping.internalSymbol}>
                <span>{mapping.internalSymbol}</span>
                <span>{mapping.brokerSymbol ?? '-'}</span>
                <span>{mapping.mappingStatus}</span>
                <span>{mapping.candidates.join(', ')}</span>
              </div>
            ))}
          </div>
        ) : null}

        {tickProbe ? (
          <div className="position-metrics">
            <span>CFD: <strong>{tickProbe.cfdSymbol ?? 'NAS100.cfd'}</strong></span>
            <span>Broker symbol: <strong>{tickProbe.brokerSymbol ?? '-'}</strong></span>
            <span>Bid: <strong>{tickProbe.bid ?? '-'}</strong></span>
            <span>Ask: <strong>{tickProbe.ask ?? '-'}</strong></span>
            <span>Mid: <strong>{tickProbe.mid ?? '-'}</strong></span>
            <span>Spread: <strong>{tickProbe.spread ?? '-'}</strong></span>
            <span>Spread bps: <strong>{tickProbe.spreadBps ?? '-'}</strong></span>
            <span>Provider: <strong>{tickProbe.provider ?? tickProbe.reason ?? '-'}</strong></span>
          </div>
        ) : null}

        <div className="code-card">
          <strong>Comandos tecnicos</strong>
          <pre>{bridgeCommands}</pre>
        </div>
        <div className="code-card">
          <strong>Archivo tecnico del bridge</strong>
          <pre>{envTemplate}</pre>
        </div>
        {advancedMessage ? <p className="reason">{advancedMessage}</p> : null}
      </details>
    </section>
  )
}
