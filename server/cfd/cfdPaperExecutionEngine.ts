import { tradingConfig } from '../config/tradingConfig.js'
import { getMicroProfitTargetNetUsd, microProfitConfig } from '../config/microProfitConfig.js'
import { getPaperAccountBase } from '../storage/paperAccountStore.js'
import { addOpenPosition, getOpenPositions } from '../storage/tradeStore.js'
import { getCfdInstrument } from '../symbols/cfdInstrumentRegistry.js'
import { evaluateCfdOpportunity } from './cfdExpertAgent.js'
import { calculateMicroProfitCosts, validateMicroProfitCosts } from './microProfitEngine.js'
import { evaluateCfdProfessionalSkill } from './cfdProfessionalSkillEngine.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'
import type { AssetClass } from '../symbols/cfdInstrumentRegistry.js'
import { validateDataGuard } from '../risk/dataGuard.js'
import { getKillSwitchStatus } from '../risk/killSwitch.js'
import { validatePortfolioRiskGuard } from '../risk/portfolioRiskGuard.js'
import { validateRiskGuard } from '../risk/riskGuard.js'
import { validateCryptoOvertradingGuard, recordCryptoOpen } from '../risk/cryptoOvertradingGuard.js'
import { validateMultiPositionPortfolioPolicy } from '../risk/multiPositionPortfolioPolicy.js'
import { isReasonableBinanceCryptoQuote } from '../feeds/binanceLivePriceProvider.js'

function desiredTargetMoveBps(assetClass: AssetClass) {
  if (assetClass === 'FOREX_CFD') return 2.5
  if (assetClass === 'INDEX_CFD') return 3.5
  if (assetClass === 'METAL_CFD') return 4
  if (assetClass === 'CRYPTO_CFD') return 8
  return 12
}

export async function openCfdPaperPosition(
  opportunity: Opportunity,
  force = false,
  riskControls: { maxLeverage?: number; maxRiskUsd?: number } = {},
) {
  const instrument = getCfdInstrument(opportunity.cfdSymbol)
  if (!instrument) return { opened: false, reason: 'Instrumento CFD no registrado.' }
  if (
    instrument.assetClass === 'CRYPTO_CFD'
    && !force
    && (opportunity.setupStatus === 'WAITING_FOR_CANDLES' || opportunity.candlePattern === 'INSUFFICIENT_CANDLES')
  ) {
    return {
      opened: false,
      reason: 'Cripto habilitada, pero no se abre main paper con velas insuficientes. Esperando vela cerrada confirmada.',
    }
  }
  const direction = opportunity.direction ?? 'LONG'
  const entryPrice = direction === 'LONG' ? opportunity.quote.ask : opportunity.quote.bid
  if (instrument.assetClass === 'CRYPTO_CFD') {
    const cryptoQuote = isReasonableBinanceCryptoQuote(instrument.underlyingSymbol, {
      ask: opportunity.quote.ask,
      bid: opportunity.quote.bid,
      price: opportunity.quote.mid,
    })
    if (!cryptoQuote.ok) return { opened: false, reason: `Precio cripto rechazado antes de abrir: ${cryptoQuote.reason}`, expert: undefined }
  }
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return { opened: false, reason: 'Precio de entrada invalido; no se abre paper trade.', expert: undefined }
  const requestedRiskPercent = instrument.assetClass === 'CRYPTO_CFD' ? tradingConfig.riskPerCryptoTradePercent : tradingConfig.riskPerTradePercent
  const openPositions = getOpenPositions()
  const openPnl = openPositions.reduce((sum, position) => sum + position.openPnl, 0)
  const usedMargin = openPositions.reduce((sum, position) => sum + position.marginRequired, 0)
  const equity = getPaperAccountBase().balance + openPnl
  const freeMargin = equity - usedMargin
  const marginLevel = usedMargin > 0 ? equity / usedMargin * 100 : 9999
  const portfolioLeverage = equity > 0 ? openPositions.reduce((sum, position) => sum + position.currentPrice * position.positionSize, 0) / equity : 0
  const desiredCorePositions = tradingConfig.maxOpenPositions
  const maxRequestedLeverage = riskControls.maxLeverage ?? 25
  const effectiveLeverage = instrument.assetClass === 'CRYPTO_CFD' ? 1 : Math.min(maxRequestedLeverage, instrument.maxLeverage)
  const maxHealthyUsedMargin = equity * (instrument.assetClass === 'CRYPTO_CFD' ? 0.66 : 0.7)
  const cryptoOpenCount = openPositions.filter((position) => position.assetClass === 'CRYPTO_CFD').length
  const slotsToReserve = instrument.assetClass === 'CRYPTO_CFD' ? Math.max(1, 4 - cryptoOpenCount) : 1
  const marginBudgetForThisTrade = Math.max(0, (maxHealthyUsedMargin - usedMargin) / slotsToReserve)
  const maxNotionalExposure = marginBudgetForThisTrade * effectiveLeverage
  if (maxNotionalExposure <= 0 && !force) return { opened: false, reason: 'Sin presupuesto de margen sano para abrir otra posicion paper.', expert: undefined }
  const microTargetNetUsd = getMicroProfitTargetNetUsd()
  const targetMoveBps = desiredTargetMoveBps(instrument.assetClass)
  const targetMoveDistance = entryPrice * targetMoveBps / 10_000
  const estimatedCostPerUnit = Math.abs(opportunity.quote.spread) * 1.5
  const netMovePerUnit = targetMoveDistance - estimatedCostPerUnit
  const targetPositionSize = netMovePerUnit > 0 ? microTargetNetUsd / netMovePerUnit : Infinity
  const maxPositionSizeByMargin = entryPrice > 0 ? maxNotionalExposure / entryPrice : 0
  const positionSize = Math.max(0, Math.min(targetPositionSize, maxPositionSizeByMargin))
  if (positionSize <= 0 && !force) return { opened: false, reason: 'Sizing orientado a target produjo tamano cero por margen insuficiente.', expert: undefined }
  const maxRiskUsd = riskControls.maxRiskUsd ?? microProfitConfig.maxLossPerTradeUsd
  const plannedRiskUsd = Math.min(maxRiskUsd, microProfitConfig.maxLossPerTradeUsd, equity * requestedRiskPercent / 100)
  const stopDistance = positionSize > 0 ? plannedRiskUsd / positionSize : entryPrice * 0.01
  const stopLoss = direction === 'LONG' ? entryPrice - stopDistance : entryPrice + stopDistance
  const microCosts = calculateMicroProfitCosts({
    positionSize,
    spread: opportunity.quote.spread,
    targetNetUsd: microTargetNetUsd,
  })
  const takeProfitDistance = positionSize > 0 ? (microTargetNetUsd + microCosts.totalEstimatedCost) / positionSize : entryPrice * 0.01
  const takeProfit = direction === 'LONG' ? entryPrice + takeProfitDistance : entryPrice - takeProfitDistance
  const riskUsd = stopDistance * positionSize
  const riskPercent = equity > 0 ? riskUsd / equity * 100 : 0
  const notionalExposure = positionSize * entryPrice
  const expectedProfit = Math.abs(takeProfit - entryPrice) * positionSize
  const expectedNetProfit = expectedProfit - microCosts.totalEstimatedCost
  const microCostValidation = validateMicroProfitCosts({ costs: microCosts, expectedNetProfit, targetNetUsd: microTargetNetUsd })
  const marginRequired = notionalExposure / effectiveLeverage
  const professional = evaluateCfdProfessionalSkill({
    account: {
      balance: getPaperAccountBase().balance,
      equity,
      freeMargin,
      marginLevel,
      openPnl,
      portfolioLeverage,
      usedMargin,
    },
    assetClass: instrument.assetClass,
    costs: microCosts,
    expectedNetProfit,
    marginRequired,
    positionSize,
    quote: opportunity.quote,
    targetNetUsd: microTargetNetUsd,
  })
  const expert = evaluateCfdOpportunity({
    quote: opportunity.quote,
    assetClass: instrument.assetClass,
    equity,
    usedMargin,
    expectedProfit,
    positionSize,
    notionalExposure,
    riskPercent,
    riskReward: 2.1,
    setupConfirmed: force ? true : opportunity.setupConfirmed,
    tradeQualityScore: 90,
    leverage: effectiveLeverage,
  })
  const data = validateDataGuard(opportunity.quote)
  const risk = validateRiskGuard({ riskPercent, riskReward: 2.1 })
  const portfolio = validatePortfolioRiskGuard({ cfdSymbol: instrument.cfdSymbol, riskPercent, assetClass: instrument.assetClass })
  const source = opportunity.source ?? (instrument.assetClass === 'CRYPTO_CFD' ? 'BINANCE_REALTIME' : 'VT_MARKETS_MT5_DEMO')
  const multiPolicy = validateMultiPositionPortfolioPolicy({
    assetClass: instrument.assetClass,
    cfdSymbol: instrument.cfdSymbol,
    direction,
    riskPercent,
    source,
  })
  const kill = getKillSwitchStatus()
  const overtrading = instrument.assetClass === 'CRYPTO_CFD' && !force ? validateCryptoOvertradingGuard() : { approved: true, reason: 'Test/manual paper permitido.', status: 'APPROVED' }
  const blockers = [
    ...expert.blockingReasons,
    ...professional.blockingReasons,
    ...microCostValidation.reasons,
    ...(data.approved ? [] : [data.reason]),
    ...risk.reasons,
    ...portfolio.reasons,
    ...multiPolicy.reasons,
    ...(kill.triggered ? kill.reasons : []),
    ...(overtrading.approved ? [] : [overtrading.reason]),
  ]
  if (blockers.length && !force) return { opened: false, reason: blockers.join(' '), expert, professional }

  const position = {
    id: `${instrument.cfdSymbol}_${Date.now()}`,
    cfdSymbol: instrument.cfdSymbol,
    underlyingSymbol: instrument.underlyingSymbol,
    source,
    assetClass: instrument.assetClass,
    direction,
    strategy: opportunity.strategy,
    entryPrice,
    currentPrice: entryPrice,
    currentAsk: opportunity.quote.ask,
    currentBid: opportunity.quote.bid,
    previousPrice: entryPrice,
    stopLoss,
    takeProfit,
    positionSize,
    riskPercent,
    riskUsd,
    marginRequired,
    leverage: effectiveLeverage,
    spreadAtEntry: opportunity.quote.spread,
    spreadCost: microCosts.spreadCost,
    commission: microCosts.commission,
    slippageEstimate: microCosts.slippageEstimate,
    swapAccrued: microCosts.swapAccrued,
    totalEstimatedCost: microCosts.totalEstimatedCost,
    costToProfitRatio: microCosts.costToProfitRatio,
    microTargetNetUsd,
    grossPnl: 0,
    netPnl: -microCosts.totalEstimatedCost,
    openPnl: 0,
    openPnlPercent: 0,
    provider: opportunity.quote.provider,
    feedType: opportunity.quote.feedType,
    openedAt: new Date().toISOString(),
    lastBrokerTickTime: opportunity.quote.brokerTime ?? null,
    lastPriceUpdate: opportunity.quote.lastPriceUpdate,
    thesis: `${opportunity.strategy} confirmado en ${instrument.cfdSymbol}. Paper only.`,
    cfdExpertScore: expert.expertScore,
    cfdExpertReason: `${expert.reason} ${professional.reason}`,
    professionalSkillScore: professional.disciplineScore,
    professionalSkillReason: professional.reason,
    candleBehaviorScoreAtEntry: opportunity.candleBehaviorScore,
    candlePatternAtEntry: opportunity.candlePattern,
    minimumMoveNeeded: professional.minimumMoveNeeded,
    minimumMoveBps: professional.minimumMoveBps,
    managementStatus: 'PAPER_TRADE_OPEN',
    nextAction: 'HOLD',
  }
  addOpenPosition(position)
  if (instrument.assetClass === 'CRYPTO_CFD') recordCryptoOpen()
  return { opened: true, position, expert, professional, reason: professional.reason }
}
