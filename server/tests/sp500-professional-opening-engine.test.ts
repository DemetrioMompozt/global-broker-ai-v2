import { buildSP500ProfessionalOpeningStatus, requiresSP500ProfessionalOpening } from '../strategy/sp500ProfessionalOpeningEngine.js'
import type { MarketOpportunityRow } from '../strategy/marketOpportunityScanner.js'
import type { ProfessionalOpeningBar } from '../strategy/trappedTraderDetector.js'
import { assert, done } from './assert.js'

function candidate(overrides: Partial<MarketOpportunityRow> = {}): MarketOpportunityRow {
  return {
    ask: 4990.5,
    bid: 4990,
    brokerSymbol: 'ES',
    cooldownUntil: null,
    costPct: 5,
    decision: 'VIABLE',
    feedStatus: 'BROKER_DEMO_REALTIME',
    lastPriceUpdate: '2026-06-05T15:00:00.000Z',
    moveRatio: 2,
    nextAction: 'PAPER_TRADE_READY',
    nextCheckAt: '2026-06-05T15:01:00.000Z',
    observedMoveBps: 40,
    reason: 'Index candidate',
    requiredMoveBps: 15,
    score: 92,
    selectedTarget: null,
    session: 'NY_OVERLAP',
    spreadBps: 2,
    spreadPct: 2,
    symbol: 'ES',
    targetCandidate: 0.08,
    ...overrides,
  }
}

function bar(timestamp: string, open: number, high: number, low: number, close: number, volume = 1000): ProfessionalOpeningBar {
  return { close, high, low, open, timestamp, volume }
}

const bars: ProfessionalOpeningBar[] = [
  bar('2026-06-04T19:55:00.000Z', 5000, 5020, 4940, 5002),
  bar('2026-06-05T12:30:00.000Z', 5000, 5012, 4980, 5005),
  bar('2026-06-05T13:30:00.000Z', 5001, 5008, 4998, 5004, 1200),
  bar('2026-06-05T13:31:00.000Z', 5004, 5010, 4999, 5008, 1300),
  bar('2026-06-05T13:32:00.000Z', 5008, 5010, 4997, 5000, 1300),
  bar('2026-06-05T13:33:00.000Z', 5000, 5006, 4996, 4999, 1300),
  bar('2026-06-05T13:34:00.000Z', 4999, 5007, 4995, 5002, 1300),
  bar('2026-06-05T13:35:00.000Z', 5002, 5009, 4998, 5005, 1300),
  bar('2026-06-05T13:36:00.000Z', 5005, 5009, 4997, 5001, 1300),
  bar('2026-06-05T13:37:00.000Z', 5001, 5006, 4996, 4998, 1300),
  bar('2026-06-05T13:38:00.000Z', 4998, 5008, 4997, 5004, 1300),
  bar('2026-06-05T13:39:00.000Z', 5004, 5010, 4998, 5008, 1300),
  bar('2026-06-05T13:40:00.000Z', 5008, 5010, 4997, 5000, 1300),
  bar('2026-06-05T13:41:00.000Z', 5000, 5007, 4996, 4999, 1300),
  bar('2026-06-05T13:42:00.000Z', 4999, 5006, 4995, 4998, 1300),
  bar('2026-06-05T13:43:00.000Z', 4998, 5005, 4996, 5000, 1300),
  bar('2026-06-05T13:44:00.000Z', 5000, 5007, 4995, 4997, 1300),
  bar('2026-06-05T13:45:00.000Z', 5008, 5014, 5007, 5012, 1800),
  bar('2026-06-05T13:46:00.000Z', 5012, 5013, 4998, 5000, 2600),
  bar('2026-06-05T13:47:00.000Z', 5000, 5001, 4984, 4985, 3100),
  bar('2026-06-05T13:48:00.000Z', 4985, 4989, 4984, 4987, 900),
  bar('2026-06-05T13:49:00.000Z', 4987, 4988, 4984, 4986, 850),
]

assert(requiresSP500ProfessionalOpening(candidate()), 'ES debe requerir el setup profesional S&P futures.')
assert(!requiresSP500ProfessionalOpening(candidate({ brokerSymbol: 'US500.cfd', symbol: 'US500.cfd' })), 'US500.cfd no debe activar el metodo video porque es CFD.')

let status = buildSP500ProfessionalOpeningStatus({
  bars,
  candidate: candidate(),
  now: new Date('2026-06-05T13:40:00.000Z'),
  safetyStatus: { brokerExecutionEnabled: false, killSwitchStatus: 'CLEAR', paperOnly: true, realTradingAllowed: false },
})
assert(status.state === 'WAITING_FOR_OPENING_RANGE', 'Antes de 15 min debe observar sin abrir.')
assert(!status.canPaperTrade, 'No puede operar durante los primeros 15 minutos.')

status = buildSP500ProfessionalOpeningStatus({
  bars,
  candidate: candidate(),
  now: new Date('2026-06-05T14:00:00.000Z'),
  safetyStatus: { brokerExecutionEnabled: false, killSwitchStatus: 'CLEAR', paperOnly: true, realTradingAllowed: false },
})
assert(status.finalDecision === 'READY_FOR_PAPER_ENTRY', `Debe quedar listo con trampa, presion y RR. Estado: ${status.state} ${status.reason}`)
assert(status.trap?.trapType === 'BULL_TRAP', 'Debe detectar bull trap.')
assert(status.direction === 'SHORT', 'Bull trap debe producir short setup.')
assert((status.riskReward?.riskRewardRatio ?? 0) >= 2, 'Debe calcular RR estructural minimo 1:2.')

status = buildSP500ProfessionalOpeningStatus({
  candidate: candidate(),
  now: new Date('2026-06-05T14:00:00.000Z'),
  safetyStatus: { brokerExecutionEnabled: false, killSwitchStatus: 'CLEAR', paperOnly: true, realTradingAllowed: false },
})
assert(status.state === 'BLOCKED_DATA', 'Sin velas no debe inventar setup.')
assert(status.blockerCode === 'DATA_NOT_READY', 'Sin barras debe explicar DATA_NOT_READY.')

done('sp500-professional-opening-engine')
