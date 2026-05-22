import { getCryptoCandles, getCryptoCandleSummary } from './cryptoCandleBuilder.js'

export function confirmCryptoSetup(symbol: string) {
  const candles = getCryptoCandles(symbol, '5s', true)
  const candles15s = getCryptoCandles(symbol, '15s', true)
  const last = candles.at(-1)
  const previous = candles.at(-2)
  const summary = getCryptoCandleSummary(symbol)
  if (candles.length < 12 || candles15s.length < 3 || !last || !previous) {
    return {
      setupStatus: 'WAITING_FOR_CANDLES',
      isConfirmed: false,
      reason: 'Faltan velas cerradas suficientes para confirmar cripto sin ruido.',
      candles: summary,
      direction: 'LONG' as const,
      riskReward: 2.1,
    }
  }
  const recent = candles.slice(-6)
  const first = recent[0]
  const upSteps = recent.slice(1).filter((candle, index) => candle.close > recent[index].close).length
  const downSteps = recent.slice(1).filter((candle, index) => candle.close < recent[index].close).length
  const avgClose = recent.reduce((sum, candle) => sum + candle.close, 0) / recent.length
  const moveBps = first.close > 0 ? (last.close - first.close) / first.close * 10_000 : 0
  const direction = moveBps >= 0 ? 'LONG' as const : 'SHORT' as const
  const momentum = direction === 'LONG'
    ? upSteps >= 4 && last.close > avgClose
    : downSteps >= 4 && last.close < avgClose
  const range = Math.max(0.0000001, last.high - last.low)
  const body = Math.abs(last.close - last.open)
  const confirmed = momentum && body / range >= 0.35 && Math.abs(moveBps) >= 3
  return {
    setupStatus: confirmed ? 'CONFIRMED' : 'SETUP_FORMING',
    isConfirmed: confirmed,
    reason: confirmed
      ? `${direction} cripto confirmado con 6 velas: movimiento ${moveBps.toFixed(2)} bps y ${direction === 'LONG' ? upSteps : downSteps}/5 pasos a favor.`
      : `Esperando cripto mas limpio: movimiento ${moveBps.toFixed(2)} bps, pasos a favor ${direction === 'LONG' ? upSteps : downSteps}/5.`,
    candles: summary,
    direction,
    riskReward: 2.1,
  }
}
