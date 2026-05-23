import { getCfdQuote } from './cfdPricingEngine.js'
import { applyClosedPnl, getPaperAccountBase } from '../storage/paperAccountStore.js'
import { closePosition, getOpenPositions, replaceOpenPositions } from '../storage/tradeStore.js'
import { recordCryptoClose } from '../risk/cryptoOvertradingGuard.js'
import { getMicroProfitTargetNetUsd, microProfitConfig } from '../config/microProfitConfig.js'
import { calculateMicroProfitCosts, calculateNetPnl, shouldCloseForMicroTarget } from './microProfitEngine.js'
import { getCfdInstrument } from '../symbols/cfdInstrumentRegistry.js'
import { observeVtEdge } from '../strategy/vtMarketsEdgeModel.js'

export async function updateOpenPositions() {
  const updated = []
  const closed = []
  const positionQuotes = await Promise.all(getOpenPositions().map(async (position) => ({
    position,
    quote: await getCfdQuote(position.cfdSymbol),
  })))
  for (const { position, quote } of positionQuotes) {
    const currentPrice = position.direction === 'LONG' ? quote.bid : quote.ask
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      updated.push({ ...position, managementStatus: 'DATA_WATCH', nextAction: 'WAIT_PRICE' })
      continue
    }
    const openPnl = position.direction === 'LONG'
      ? (currentPrice - position.entryPrice) * position.positionSize
      : (position.entryPrice - currentPrice) * position.positionSize
    const microTargetNetUsd = getMicroProfitTargetNetUsd()
    const costs = {
      commission: position.commission ?? 0,
      slippageEstimate: position.slippageEstimate ?? 0,
      spreadCost: position.spreadCost ?? calculateMicroProfitCosts({ positionSize: position.positionSize, spread: position.spreadAtEntry, targetNetUsd: microTargetNetUsd }).spreadCost,
      swapAccrued: position.swapAccrued ?? 0,
      totalEstimatedCost: position.totalEstimatedCost ?? 0,
      costToProfitRatio: position.costToProfitRatio ?? 0,
    }
    const netPnl = calculateNetPnl(openPnl, costs)
    const bestOpenPnl = Math.max(position.bestOpenPnl ?? position.openPnl ?? 0, netPnl)
    const openPnlPercent = getPaperAccountBase().balance > 0 ? netPnl / getPaperAccountBase().balance * 100 : 0
    const next = {
      ...position,
      previousPrice: position.currentPrice,
      currentPrice,
      currentAsk: quote.ask,
      currentBid: quote.bid,
      grossPnl: Number(openPnl.toFixed(6)),
      netPnl,
      bestOpenPnl: Number(bestOpenPnl.toFixed(6)),
      openPnl: netPnl,
      openPnlPercent: Number(openPnlPercent.toFixed(6)),
      provider: quote.provider,
      feedType: quote.feedType,
      lastBrokerTickTime: quote.brokerTime ?? null,
      lastPriceUpdate: quote.lastPriceUpdate,
      managementStatus: 'MANAGING_POSITION',
      nextAction: 'HOLD',
      microTargetNetUsd,
    }
    const microTarget = shouldCloseForMicroTarget({ grossPnl: openPnl, costs, targetNetUsd: microTargetNetUsd })
    const maxLossHit = netPnl <= -microProfitConfig.maxLossPerTradeUsd
    const ageSeconds = Math.max(0, (Date.now() - new Date(position.openedAt).getTime()) / 1000)
    const instrument = getCfdInstrument(position.cfdSymbol)
    const vtEdge = instrument && position.source === 'VT_MARKETS_MT5_DEMO' && quote.feedType === 'BROKER_DEMO_REALTIME'
      ? observeVtEdge(position.cfdSymbol, quote, instrument.assetClass)
      : null
    const strongOppositeVtEdge = Boolean(
      vtEdge?.confirmed
      && vtEdge.direction !== position.direction
      && Math.abs(vtEdge.moveBps) >= vtEdge.requiredMoveBps * 1.2
      && vtEdge.persistence >= 0.5
      && vtEdge.efficiency >= 0.22,
    )
    const sameDirectionVtEdge = Boolean(vtEdge?.confirmed && vtEdge.direction === position.direction)
    const vtThesisInvalidated = Boolean(strongOppositeVtEdge && ageSeconds >= 45 && netPnl <= -0.75)
    const vtThesisLost = Boolean(vtEdge && vtEdge.setupStatus !== 'BUILDING_EDGE_MEMORY' && !sameDirectionVtEdge && ageSeconds >= 90 && netPnl <= -1.25)
    const traderSkillCutLoser = Boolean(position.source === 'VT_MARKETS_MT5_DEMO' && ageSeconds >= 75 && netPnl <= -2 && !sameDirectionVtEdge)
    const givebackProtection = Boolean(bestOpenPnl >= 1.1 && netPnl <= -0.15 && ageSeconds >= 45)
    const cryptoFastInvalidated = position.assetClass === 'CRYPTO_CFD' && ageSeconds >= 75 && netPnl <= -1
    const microTimeStop = ageSeconds >= microProfitConfig.maxHoldSeconds
    const stopHit = position.direction === 'LONG' ? currentPrice <= position.stopLoss : currentPrice >= position.stopLoss
    const tpHit = position.direction === 'LONG' ? currentPrice >= position.takeProfit : currentPrice <= position.takeProfit
    if (microTarget.close || vtThesisInvalidated || vtThesisLost || traderSkillCutLoser || givebackProtection || cryptoFastInvalidated || microTimeStop || maxLossHit || stopHit || tpHit) {
      const exitReason = microTarget.close
        ? 'MICRO_CLOSE_TARGET'
        : vtThesisInvalidated
          ? 'THESIS_INVALIDATED'
          : vtThesisLost
            ? 'THESIS_LOST_NO_EDGE'
          : traderSkillCutLoser
            ? 'TRADER_SKILL_CUT_LOSER'
          : givebackProtection
            ? 'TRADER_SKILL_GIVEBACK_PROTECTION'
          : cryptoFastInvalidated
            ? 'CRYPTO_FAST_INVALIDATION'
          : microTimeStop
            ? 'MICRO_TIME_STOP'
            : maxLossHit ? 'MICRO_MAX_LOSS' : stopHit ? 'STOP_LOSS' : 'TAKE_PROFIT'
      const trade = closePosition(position.id, currentPrice, exitReason, netPnl, openPnl)
      if (trade) {
        applyClosedPnl(trade.pnl)
        recordCryptoClose()
        closed.push(trade)
      }
    } else {
      updated.push(next)
    }
  }
  replaceOpenPositions(updated)
  return { updated, closed }
}
