import { analyzeTraderVideoEntry } from '../strategy/traderVideoAnalyticalAgent.js'
import { assert, done } from './assert.js'

function baseInput(overrides: Record<string, unknown> = {}) {
  const wrongSidedTrader = {
    confidence: 86,
    confirmationStrength: 88,
    failedLevel: 'openingRangeHigh',
    failedLevelPrice: 7452,
    likelyStopZone: 7455,
    reason: 'Compradores atrapados arriba del ORH.',
    reclaimOrRejectPrice: 7448,
    trapType: 'BULL_TRAP',
    trappedSide: 'BUYERS',
    wrongSidedState: 'BUYERS_TRAPPED',
  }
  const movementNature = {
    continuationStrength: 88,
    dominantPressure: 'BEARISH',
    explanation: 'Impulso bajista dominante con pullback lento y solapado.',
    impulseStrength: 92,
    impulseVelocity: 3.2,
    institutionalPressureScore: 91,
    moveAsymmetryScore: 86,
    pullbackVelocity: 0.7,
    pullbackWeakness: 88,
    recoveryFailure: 86,
    volumeConfirmation: 82,
    wickRejection: 80,
  }
  const trendlineFailure = {
    attemptedRecoveryCount: 2,
    canUseForEntry: true,
    direction: 'SHORT',
    reason: 'Trendline de 3 puntos rota; retest fallo.',
    state: 'RECOVERY_ATTEMPT_FAILED',
    trendline: {
      anchorCount: 3,
      anchors: [
        { price: 7434, role: 'START', timestamp: '2026-06-05T13:50:00.000Z' },
        { price: 7438, role: 'CONFIRMATION', timestamp: '2026-06-05T13:54:00.000Z' },
        { price: 7442, role: 'END', timestamp: '2026-06-05T13:58:00.000Z' },
      ],
      confirmationPrice: 7438,
      confirmationTimestamp: '2026-06-05T13:54:00.000Z',
      endPrice: 7442,
      endTimestamp: '2026-06-05T13:58:00.000Z',
      projectedCurrentPrice: 7440,
      qualityScore: 94,
      role: 'RISING_SUPPORT',
      slopePerMinute: 1,
      startPrice: 7434,
      startTimestamp: '2026-06-05T13:50:00.000Z',
    },
  }
  const weakCountermove = {
    canUseForEntry: true,
    counterMoveBars: 6,
    intendedDirection: 'SHORT',
    movementNature,
    openingRangeLevel: 'HIGH',
    reason: 'Contramovimiento alcista debil confirmado.',
    state: 'RETEST_FAILED',
    trappedSide: 'BUYERS',
    trendlineCandlestickExpert: {
      blockers: [],
      candlestickConfirmationScore: 88,
      candleRead: 'SHORT confirmado por vela de ruptura bajista y retest con mecha superior.',
      direction: 'SHORT',
      evidence: {
        anchorCount: 3,
        breakCandle: null,
        breakCloseDistance: 1.2,
        expectedTrendlineRole: 'RISING_SUPPORT',
        latestCandle: null,
        retestCandle: null,
        retestRejectDistance: 1.1,
        trendlineRole: 'RISING_SUPPORT',
      },
      mode: 'TRENDLINE_CANDLESTICK_EXPERT',
      nextCondition: 'Trendline y velas confirman; pasar a caja rojo/verde y safety paper.',
      overallScore: 90,
      retestFailureScore: 88,
      status: 'CONFIRMED',
      timestamp: '2026-06-05T14:00:00.000Z',
      trendlineQualityScore: 92,
      trendlineRead: 'Soporte alcista de 3 puntos confirmado.',
    },
    trendlineFailure,
    weakCountermoveScore: 84,
    wrongSidedTrader,
  }
  const redGreenBox = {
    greenBoxReward: 10.75,
    redBoxRisk: 4.5,
    riskReward: {
      blockers: [],
      costToTargetRatio: 0.12,
      decision: 'APPROVED',
      entryPrice: 7440,
      expectedNetProfit: 0.08,
      reason: 'RR estructural 2.39 con target neto positivo.',
      riskRewardRatio: 2.39,
      stopDistance: 4.5,
      structuralTarget: 7429.25,
      targetDistance: 10.75,
      targetNetUsd: 0.08,
      technicalStop: 7444.5,
    },
    state: 'VALID_RED_GREEN_BOX',
    structuralTarget: 7429.25,
    technicalStop: 7444.5,
  }
  return {
    currentPrice: 7440,
    dataQuality: {
      barsCount: 90,
      feedFresh: true,
      hasLevels: true,
      hasTimezoneClarity: true,
      marketClosed: false,
    },
    movementNature,
    openingRange: {
      fakeBreakAbove: true,
      fakeBreakBelow: false,
      firstImpulseDirection: 'DOWN',
      firstImpulseStrength: 80,
      openingRangeDirection: 'UP',
      openingRangeHigh: 7452,
      openingRangeLow: 7440,
      openingRangeMid: 7446,
      openingRangeSize: 12,
      reactionAtPreviousLevels: true,
      state: 'OPENING_RANGE_COMPLETED',
    },
    premarketLevels: {
      importantReactionZones: [],
      overnightHigh: 7454,
      overnightLow: 7418,
      overnightRange: 36,
      previousDayClose: 7422,
      previousDayHigh: 7478,
      previousDayLow: 7388,
      state: 'MARKING_PREMARKET_LEVELS',
      vwap: 7448,
    },
    redGreenBox,
    sessionPhase: 'MAIN_WINDOW',
    structuralRiskReward: redGreenBox.riskReward,
    symbol: 'SP500',
    trendlineFailure,
    weakCountermove,
    wrongSidedTrader,
    ...overrides,
  } as any
}

const perfectShort = analyzeTraderVideoEntry(baseInput())
assert(perfectShort.finalDecision === 'GOOD_ENTRY', `Short perfecto debe ser GOOD_ENTRY, recibio ${perfectShort.finalDecision}`)
assert(perfectShort.overallTradeQualityScore >= 85, 'Short perfecto debe tener calidad alta.')

const perfectLong = analyzeTraderVideoEntry(baseInput({
  movementNature: {
    ...baseInput().movementNature,
    dominantPressure: 'BULLISH',
    explanation: 'Impulso alcista dominante con pullback bajista debil.',
  },
  redGreenBox: {
    ...baseInput().redGreenBox,
    riskReward: { ...baseInput().redGreenBox.riskReward, riskRewardRatio: 2.25, reason: 'RR estructural 2.25.' },
  },
  structuralRiskReward: { ...baseInput().redGreenBox.riskReward, riskRewardRatio: 2.25, reason: 'RR estructural 2.25.' },
  trendlineFailure: {
    ...baseInput().trendlineFailure,
    direction: 'LONG',
    trendline: { ...baseInput().trendlineFailure.trendline, role: 'FALLING_RESISTANCE', slopePerMinute: -1 },
  },
  weakCountermove: {
    ...baseInput().weakCountermove,
    intendedDirection: 'LONG',
    openingRangeLevel: 'LOW',
    trappedSide: 'SELLERS',
    trendlineCandlestickExpert: {
      ...baseInput().weakCountermove.trendlineCandlestickExpert,
      candleRead: 'LONG confirmado por vela de ruptura alcista y retest con mecha inferior.',
      direction: 'LONG',
      evidence: {
        ...baseInput().weakCountermove.trendlineCandlestickExpert.evidence,
        expectedTrendlineRole: 'FALLING_RESISTANCE',
        trendlineRole: 'FALLING_RESISTANCE',
      },
      trendlineRead: 'Resistencia bajista de 3 puntos confirmada.',
    },
    wrongSidedTrader: {
      ...baseInput().wrongSidedTrader,
      failedLevel: 'openingRangeLow',
      trapType: 'BEAR_TRAP',
      trappedSide: 'SELLERS',
      wrongSidedState: 'SELLERS_TRAPPED',
    },
  },
  wrongSidedTrader: {
    ...baseInput().wrongSidedTrader,
    failedLevel: 'openingRangeLow',
    trapType: 'BEAR_TRAP',
    trappedSide: 'SELLERS',
    wrongSidedState: 'SELLERS_TRAPPED',
  },
}))
assert(perfectLong.finalDecision === 'GOOD_ENTRY', `Long perfecto debe ser GOOD_ENTRY, recibio ${perfectLong.finalDecision}`)

const noTrappedSide = analyzeTraderVideoEntry(baseInput({
  weakCountermove: { ...baseInput().weakCountermove, trappedSide: 'NONE', wrongSidedTrader: null },
  wrongSidedTrader: null,
}))
assert(noTrappedSide.finalDecision === 'NO_TRADE', 'Trendline sin atrapados claros no puede abrir.')
assert(noTrappedSide.blockedReasons.includes('BLOCKED_NO_CLEAR_TRAPPED_SIDE'), 'Debe explicar falta de atrapados.')

const levelsOnlyNoInteraction = analyzeTraderVideoEntry(baseInput({
  openingRange: {
    ...baseInput().openingRange,
    fakeBreakAbove: false,
    fakeBreakBelow: false,
    reactionAtPreviousLevels: false,
  },
  testedLevel: null,
  weakCountermove: {
    ...baseInput().weakCountermove,
    openingRangeLevel: null,
    trappedSide: 'NONE',
    wrongSidedTrader: null,
  },
  wrongSidedTrader: null,
}))
assert(levelsOnlyNoInteraction.finalDecision === 'NO_TRADE', 'Marcas cargadas sin interaccion real no pueden abrir.')
assert(levelsOnlyNoInteraction.blockedReasons.includes('BLOCKED_NO_MARK_INTERACTION'), 'Debe bloquear si solo lee marcas sin analizarlas.')

const pullbackNotWeak = analyzeTraderVideoEntry(baseInput({
  weakCountermove: {
    ...baseInput().weakCountermove,
    counterMoveBars: 2,
    state: 'BLOCKED_NO_WEAK_COUNTERMOVE',
    weakCountermoveScore: 20,
  },
}))
assert(pullbackNotWeak.finalDecision === 'NO_TRADE', 'Atrapados sin contramovimiento debil no puede abrir.')
assert(pullbackNotWeak.blockedReasons.includes('BLOCKED_PULLBACK_NOT_WEAK'), 'Debe explicar pullback no debil.')

const rrTooLow = analyzeTraderVideoEntry(baseInput({
  redGreenBox: {
    ...baseInput().redGreenBox,
    riskReward: {
      ...baseInput().redGreenBox.riskReward,
      blockers: ['BAD_RISK_REWARD: RR 1.5 < 2.'],
      decision: 'BLOCKED',
      riskRewardRatio: 1.5,
    },
    state: 'BLOCKED_BAD_RR',
  },
  structuralRiskReward: {
    ...baseInput().redGreenBox.riskReward,
    blockers: ['BAD_RISK_REWARD: RR 1.5 < 2.'],
    decision: 'BLOCKED',
    riskRewardRatio: 1.5,
  },
}))
assert(rrTooLow.finalDecision === 'NO_TRADE', 'R:R menor a 2 debe bloquear.')
assert(rrTooLow.blockedReasons.includes('BLOCKED_RR_BELOW_2'), 'Debe usar bloqueo especifico de R:R.')

const noRetest = analyzeTraderVideoEntry(baseInput({
  trendlineFailure: {
    ...baseInput().trendlineFailure,
    canUseForEntry: false,
    state: 'BROKEN_WITHOUT_RETEST',
  },
  weakCountermove: {
    ...baseInput().weakCountermove,
    canUseForEntry: false,
    state: 'TRENDLINE_BROKEN',
    trendlineCandlestickExpert: {
      ...baseInput().weakCountermove.trendlineCandlestickExpert,
      blockers: ['BLOCKED_NO_RETEST_FAILURE'],
      candleRead: 'La ruptura tiene cierre, pero falta vela de retest fallido; no basta romper la linea.',
      nextCondition: 'Esperar que el precio intente recuperar la linea y falle con vela cerrada.',
      overallScore: 62,
      status: 'WAITING_RETEST',
    },
    trendlineFailure: {
      ...baseInput().trendlineFailure,
      canUseForEntry: false,
      state: 'BROKEN_WITHOUT_RETEST',
    },
  },
}))
assert(noRetest.finalDecision === 'NO_TRADE', 'Presion sin retest fallido no puede abrir.')
assert(noRetest.blockedReasons.includes('BLOCKED_NO_RETEST_FAILURE'), 'Debe exigir retest fallido.')

const incompleteData = analyzeTraderVideoEntry(baseInput({
  dataQuality: {
    barsCount: 8,
    feedFresh: false,
    hasLevels: false,
    hasTimezoneClarity: false,
    marketClosed: true,
  },
}))
assert(incompleteData.finalDecision === 'NO_TRADE', 'Datos incompletos no pueden abrir.')
assert(incompleteData.blockedReasons.includes('BLOCKED_DATA_CONFIDENCE_LOW'), 'Debe explicar baja confianza de datos.')

done('trader-video-analytical-agent')
