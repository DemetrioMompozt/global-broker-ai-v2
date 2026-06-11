import { buildTraderVideoReplicationMode, canTraderVideoModeOpen } from '../strategy/traderVideoReplicationMode.js'
import { assert, done } from './assert.js'

const cryptoCandidate = {
  ask: 65,
  bid: 64.9,
  cooldownUntil: null,
  costPct: 4,
  decision: 'VIABLE',
  feedStatus: 'REALTIME_TICK',
  lastPriceUpdate: '2026-06-05T14:00:00.000Z',
  moveRatio: 2,
  nextAction: 'PAPER_TRADE_READY',
  nextCheckAt: '2026-06-05T14:01:00.000Z',
  observedMoveBps: 20,
  reason: 'generic crypto candidate',
  requiredMoveBps: 10,
  score: 95,
  selectedTarget: null,
  session: 'NY_OVERLAP',
  spreadBps: 4,
  spreadPct: 2,
  symbol: 'SOLUSD.cfd',
  targetCandidate: 0.02,
} as any

let mode = buildTraderVideoReplicationMode({ candidate: cryptoCandidate, now: new Date('2026-06-05T14:00:00.000Z') })
assert(mode.state === 'BLOCKED_NON_VIDEO_MODE_ENTRY', 'Crypto no puede originar entrada en modo video.')
assert(!canTraderVideoModeOpen(mode), 'Modo video no abre candidatos no S&P.')

mode = buildTraderVideoReplicationMode({
  now: new Date('2026-06-05T14:00:00.000Z'),
  scanner: {
    rows: [cryptoCandidate],
  } as any,
})
assert(mode.state === 'BLOCKED_NO_SP500_SYMBOL_AVAILABLE', 'Si no hay S&P, no debe reemplazarlo por otro mercado.')

mode = buildTraderVideoReplicationMode({
  bars: [
    { close: 5000, high: 5001, low: 4999, open: 5000, timestamp: '2026-06-05T13:30:00.000Z', volume: 1000 },
  ],
  now: new Date('2026-06-05T12:45:00.000Z'),
  officialBrokerSymbol: 'SP500.',
  officialLastPrice: 5000,
  officialSpreadBps: 1,
  officialSymbol: 'SP500',
})
assert(mode.symbol === 'SP500', 'Debe usar el simbolo oficial S&P futures/no-CFD aunque no haya candidato del scanner.')
assert(mode.state !== 'BLOCKED_NO_SP500_SYMBOL_AVAILABLE', 'Con simbolo oficial no debe decir que no hay S&P.')

mode = buildTraderVideoReplicationMode({
  bars: [],
  now: new Date('2026-06-05T03:00:00.000Z'),
  officialBrokerSymbol: 'SP500.',
  officialLastPrice: null,
  officialSpreadBps: null,
  officialSymbol: 'SP500',
  scanner: {
    rows: [cryptoCandidate],
  } as any,
})
assert(mode.symbol === 'SP500', 'Debe conservar el simbolo oficial S&P aunque el scanner generico no traiga S&P y el mercado este cerrado.')
assert(mode.state !== 'BLOCKED_NO_SP500_SYMBOL_AVAILABLE', 'Mercado cerrado no debe confundirse con falta de simbolo S&P.')
assert(mode.candidate?.feedStatus === 'MARKET_CLOSED_OR_NO_LAST_PRICE', 'Debe explicar que falta precio vivo, no simbolo.')

mode = buildTraderVideoReplicationMode({
  bars: [
    { close: 5000, high: 5005, low: 4995, open: 5001, timestamp: '2026-06-05T13:30:00.000Z', volume: 1000 },
    { close: 5010, high: 5012, low: 5000, open: 5000, timestamp: '2026-06-05T14:00:00.000Z', volume: 1000 },
  ],
  now: new Date('2026-06-05T20:05:00.000Z'),
  officialBrokerSymbol: 'SP500.',
  officialLastPrice: 5010,
  officialSpreadBps: 1,
  officialSymbol: 'SP500',
  scanner: {
    rows: [cryptoCandidate],
  } as any,
})
assert(mode.symbol === 'SP500', 'Fuera de ventana debe seguir mostrando el simbolo oficial.')
assert(mode.state === 'BLOCKED_MARKET_CLOSED', 'Despues de 16:00 New York no debe evaluar trendline ni entrada.')
assert(!canTraderVideoModeOpen(mode), 'Fuera de ventana no puede abrir paper trade.')

done('trader-video-only-mode')
