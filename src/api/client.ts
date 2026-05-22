import type { BridgeEnvCheck, CfdPaperStatus, CfdResearchLearningStatus, MicroProfitStatus, SaveBridgeEnvResponse, VtAccount, VtMappingResponse, VtMarketsConnectionWizardResult, VtSetupDiagnostics, VtSymbolsResponse, VtTickResponse } from '../types/trading'

async function request<T>(path: string, options?: RequestInit) {
  const response = await fetch(`${path}${path.includes('?') ? '&' : '?'}t=${Date.now()}`, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
  if (!response.ok) throw new Error(await response.text())
  return await response.json() as T
}

export function fetchCfdPaperStatus() {
  return request<CfdPaperStatus>('/api/cfd-paper/status')
}

export function startAgent() {
  return request<{ ok: boolean }>('/api/cfd-paper/start-agent', { method: 'POST' })
}

export function stopAgent() {
  return request<{ ok: boolean }>('/api/cfd-paper/stop-agent', { method: 'POST' })
}

export function activateRecoveryProbe() {
  return request<{ ok: boolean }>('/api/cfd-paper/activate-recovery-probe', { method: 'POST' })
}

export function activateDefensiveDiagnostic() {
  return request<{ ok: boolean }>('/api/cfd-paper/activate-defensive-diagnostic', { method: 'POST' })
}

export function runResearchLearning() {
  return request<{ brokerExecutionEnabled: false; cfdResearchLearning: CfdResearchLearningStatus; ok: boolean; realTradingAllowed: false }>('/api/cfd-paper/run-research-learning', { method: 'POST' })
}

export function openTestPosition(symbol = 'BTCUSD.cfd') {
  return request<{ opened: boolean; status: CfdPaperStatus }>('/api/cfd-paper/open-test-position', {
    method: 'POST',
    body: JSON.stringify({ symbol }),
  })
}

export function closePosition(id: string) {
  return request<{ ok: boolean }>('/api/cfd-paper/close-position', {
    method: 'POST',
    body: JSON.stringify({ id }),
  })
}

export function setMicroProfitTarget(targetNetUsd: number) {
  return request<{ brokerExecutionEnabled: false; microProfit: MicroProfitStatus; ok: boolean; realTradingAllowed: false; targetNetUsd: number }>('/api/cfd-paper/micro-profit-target', {
    method: 'POST',
    body: JSON.stringify({ targetNetUsd }),
  })
}

export function fetchVtSetupDiagnostics() {
  return request<VtSetupDiagnostics>('/api/vt-markets/setup-diagnostics')
}

export function fetchBridgeEnvCheck() {
  return request<BridgeEnvCheck>('/api/vt-markets/bridge-env-check')
}

export function saveBridgeEnv(input: { login: string; password: string; server: string }) {
  return request<SaveBridgeEnvResponse>('/api/vt-markets/save-bridge-env', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function connectVtMarketsDemo(input: { login?: string; password?: string; server?: string }) {
  return request<VtMarketsConnectionWizardResult>('/api/vt-markets/connect-demo', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchVtAccount() {
  return request<VtAccount>('/api/vt-markets/account')
}

export function fetchVtSymbols() {
  return request<VtSymbolsResponse>('/api/vt-markets/symbols')
}

export function fetchVtMapping() {
  return request<VtMappingResponse>('/api/vt-markets/mapping')
}

export function fetchVtTick(symbol = 'NAS100.cfd') {
  return request<VtTickResponse>(`/api/vt-markets/tick?symbol=${encodeURIComponent(symbol)}`)
}
