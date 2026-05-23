import { useEffect, useRef, useState } from 'react'
import { connectVtMarketsDemo, fetchBridgeEnvCheck } from '../../api/client'
import type { BridgeEnvCheck, CfdPaperStatus, VtAccount, VtMarketsConnectionWizardResult } from '../../types/trading'
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
  const [wizardResult, setWizardResult] = useState<VtMarketsConnectionWizardResult | null>(null)
  const [envProbe, setEnvProbe] = useState<BridgeEnvCheck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const autoConnectAttempted = useRef(false)

  const status = simpleStatus(vt, wizardResult)
  const blocked = status === 'Bloqueado por seguridad'
  const connected = status === 'Conectado demo'
  const account = wizardResult?.account ?? vt.account
  const symbolsCount = wizardResult?.technical.symbolsCount ?? vt.symbolsMapped
  const feed = wizardResult?.technical.testTick?.feedType ?? (connected ? 'BROKER_DEMO_REALTIME' : null)
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

      <div className="demo-config-form saved-connect-form">
        {hasSavedDemoConfig ? (
          <div className="saved-demo-config">
            <span>Cuenta demo guardada</span>
            <strong>{envProbe?.server || vt.server || 'VT Markets Demo'} · {envProbe?.loginMasked || vt.loginMasked || 'login demo'}</strong>
            <small>La app se conecta automaticamente sin mostrar el password.</small>
          </div>
        ) : (
          <div className="saved-demo-config">
            <span>Conector automatico</span>
            <strong>Esperando configuracion segura del servidor</strong>
            <small>No se piden credenciales en la pantalla principal.</small>
          </div>
        )}
        <div className="auto-status-card">
          <span>Conexion automatica</span>
          <strong>{connected ? 'Activa' : 'Verificando'}</strong>
          <small>VT Markets se valida en segundo plano.</small>
        </div>
      </div>

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

      {connected || wizardResult ? (
        <SimpleAccount account={account} symbolsCount={symbolsCount} feed={feed} />
      ) : null}

      {error ? <p className="warning">{error}</p> : null}

      <details className="advanced-diagnostics">
        <summary>Ver diagnostico avanzado</summary>
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

        <div className="code-card">
          <strong>Comandos tecnicos</strong>
          <pre>{bridgeCommands}</pre>
        </div>
        <div className="code-card">
          <strong>Archivo tecnico del bridge</strong>
          <pre>{envTemplate}</pre>
        </div>
      </details>
    </section>
  )
}
