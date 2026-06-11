import { analyzeTraderVideoEntry, buildTraderVideoAgentAuthority, type TraderVideoAnalyticalAgentInput, type TraderVideoAnalyticalFinalDecision } from './traderVideoAnalyticalAgent.js'

export type TraderVideoScenarioId =
  | 'BUYERS_TRAPPED_VALID_SHORT'
  | 'SELLERS_TRAPPED_VALID_LONG'
  | 'BREAKOUT_ACCEPTED_NO_TRADE'
  | 'TWO_POINT_TRENDLINE_BLOCKED'
  | 'RR_BELOW_2_BLOCKED'

export type TraderVideoScenarioSimulation = {
  agentDecision: TraderVideoAnalyticalFinalDecision
  canOpenTactically: boolean
  expectedDecision: TraderVideoAnalyticalFinalDecision
  id: TraderVideoScenarioId
  passed: boolean
  reason: string
  tacticalBlockers: string[]
}

export type TraderVideoScenarioSimulationStatus = {
  failedScenarios: TraderVideoScenarioSimulation[]
  mode: 'TRADER_VIDEO_SCENARIO_SIMULATOR'
  passedScenarios: number
  scenarios: TraderVideoScenarioSimulation[]
  summary: string
  timestamp: string
  totalScenarios: number
}

const baseLevels = {
  importantReactionZones: [],
  overnightHigh: 7454,
  overnightLow: 7418,
  overnightRange: 36,
  previousDayClose: 7422,
  previousDayHigh: 7478,
  previousDayLow: 7388,
  state: 'MARKING_PREMARKET_LEVELS',
  vwap: 7448,
}

const baseOpeningRange = {
  firstImpulseStrength: 82,
  openingRangeHigh: 7452,
  openingRangeLow: 7440,
  openingRangeMid: 7446,
  openingRangeSize: 12,
  reactionAtPreviousLevels: true,
  state: 'OPENING_RANGE_COMPLETED',
}

function rr(ratio: number) {
  return {
    blockers: ratio >= 2 ? [] : ['RR_BELOW_2'],
    costToTargetRatio: 0.1,
    decision: ratio >= 2 ? 'APPROVED' : 'BLOCKED',
    entryPrice: 7440,
    expectedNetProfit: ratio >= 2 ? 0.08 : 0.01,
    reason: `RR estructural ${ratio}.`,
    riskRewardRatio: ratio,
    stopDistance: 4,
    structuralTarget: ratio >= 2 ? 7430 : 7435,
    targetDistance: 4 * ratio,
    targetNetUsd: ratio >= 2 ? 0.08 : 0.01,
    technicalStop: 7444,
  }
}

function trendline(anchorCount: number, role: 'RISING_SUPPORT' | 'FALLING_RESISTANCE') {
  return {
    anchorCount,
    anchors: [],
    confirmationPrice: 7438,
    confirmationTimestamp: '2026-06-05T13:54:00.000Z',
    endPrice: 7442,
    endTimestamp: '2026-06-05T13:58:00.000Z',
    projectedCurrentPrice: 7440,
    qualityScore: anchorCount >= 3 ? 94 : 48,
    role,
    slopePerMinute: role === 'RISING_SUPPORT' ? 1 : -1,
    startPrice: 7434,
    startTimestamp: '2026-06-05T13:50:00.000Z',
  }
}

function trendlineCandleExpert(direction: 'LONG' | 'SHORT') {
  return {
    blockers: [],
    candlestickConfirmationScore: 88,
    candleRead: direction === 'SHORT'
      ? 'SHORT confirmado por vela de ruptura bajista y retest con mecha superior.'
      : 'LONG confirmado por vela de ruptura alcista y retest con mecha inferior.',
    direction,
    evidence: {
      anchorCount: 3,
      breakCandle: null,
      breakCloseDistance: 1.2,
      expectedTrendlineRole: direction === 'SHORT' ? 'RISING_SUPPORT' : 'FALLING_RESISTANCE',
      latestCandle: null,
      retestCandle: null,
      retestRejectDistance: 1.1,
      trendlineRole: direction === 'SHORT' ? 'RISING_SUPPORT' : 'FALLING_RESISTANCE',
    },
    mode: 'TRENDLINE_CANDLESTICK_EXPERT',
    nextCondition: 'Trendline y velas confirman; pasar a caja rojo/verde y safety paper.',
    overallScore: 90,
    retestFailureScore: 88,
    status: 'CONFIRMED',
    timestamp: '2026-06-05T14:00:00.000Z',
    trendlineQualityScore: 92,
    trendlineRead: direction === 'SHORT' ? 'Soporte alcista de 3 puntos confirmado.' : 'Resistencia bajista de 3 puntos confirmada.',
  }
}

function movement(side: 'BEARISH' | 'BULLISH') {
  return {
    continuationStrength: 88,
    dominantPressure: side,
    explanation: `${side === 'BEARISH' ? 'Impulso bajista' : 'Impulso alcista'} dominante.`,
    impulseStrength: 92,
    impulseVelocity: 3,
    institutionalPressureScore: 91,
    moveAsymmetryScore: 86,
    pullbackVelocity: 0.7,
    pullbackWeakness: 88,
    recoveryFailure: 86,
    volumeConfirmation: 82,
    wickRejection: 80,
  }
}

function validShort(overrides: Partial<TraderVideoAnalyticalAgentInput> = {}): TraderVideoAnalyticalAgentInput {
  const riskReward = rr(2.5)
  return {
    dataQuality: {
      barsCount: 90,
      feedFresh: true,
      hasLevels: true,
      hasTimezoneClarity: true,
      marketClosed: false,
    },
    openingRange: {
      ...baseOpeningRange,
      fakeBreakAbove: true,
      fakeBreakBelow: false,
      firstImpulseDirection: 'DOWN',
      openingRangeDirection: 'UP',
    } as any,
    premarketLevels: baseLevels as any,
    redGreenBox: {
      greenBoxReward: 10,
      redBoxRisk: 4,
      riskReward,
      state: riskReward.decision === 'APPROVED' ? 'VALID_RED_GREEN_BOX' : 'BLOCKED',
      structuralTarget: riskReward.structuralTarget,
      technicalStop: riskReward.technicalStop,
    } as any,
    sessionPhase: 'MAIN_WINDOW',
    symbol: 'SP500',
    trendlineFailure: {
      attemptedRecoveryCount: 2,
      canUseForEntry: true,
      direction: 'SHORT',
      reason: 'Retest fallo.',
      state: 'RECOVERY_ATTEMPT_FAILED',
      trendline: trendline(3, 'RISING_SUPPORT'),
    } as any,
    weakCountermove: {
      canUseForEntry: true,
      counterMoveBars: 6,
      intendedDirection: 'SHORT',
      movementNature: movement('BEARISH'),
      openingRangeLevel: 'HIGH',
      reason: 'Pullback comprador debil.',
      state: 'RETEST_FAILED',
      trappedSide: 'BUYERS',
      trendlineCandlestickExpert: trendlineCandleExpert('SHORT'),
      trendlineFailure: null,
      weakCountermoveScore: 84,
      wrongSidedTrader: null,
    } as any,
    wrongSidedTrader: {
      confidence: 86,
      confirmationStrength: 88,
      failedLevel: 'openingRangeHigh',
      failedLevelPrice: 7452,
      likelyStopZone: 7455,
      reason: 'Compradores atrapados.',
      reclaimOrRejectPrice: 7448,
      trapType: 'BULL_TRAP',
      trappedSide: 'BUYERS',
      wrongSidedState: 'BUYERS_TRAPPED',
    } as any,
    ...overrides,
  }
}

function validLong(): TraderVideoAnalyticalAgentInput {
  const riskReward = rr(2.5)
  return {
    ...validShort(),
    openingRange: {
      ...baseOpeningRange,
      fakeBreakAbove: false,
      fakeBreakBelow: true,
      firstImpulseDirection: 'UP',
      openingRangeDirection: 'DOWN',
    } as any,
    redGreenBox: {
      greenBoxReward: 10,
      redBoxRisk: 4,
      riskReward,
      state: 'VALID_RED_GREEN_BOX',
      structuralTarget: 7455,
      technicalStop: 7436,
    } as any,
    trendlineFailure: {
      attemptedRecoveryCount: 2,
      canUseForEntry: true,
      direction: 'LONG',
      reason: 'Retest fallo.',
      state: 'RECOVERY_ATTEMPT_FAILED',
      trendline: trendline(3, 'FALLING_RESISTANCE'),
    } as any,
    weakCountermove: {
      canUseForEntry: true,
      counterMoveBars: 6,
      intendedDirection: 'LONG',
      movementNature: movement('BULLISH'),
      openingRangeLevel: 'LOW',
      reason: 'Pullback vendedor debil.',
      state: 'RETEST_FAILED',
      trappedSide: 'SELLERS',
      trendlineCandlestickExpert: trendlineCandleExpert('LONG'),
      trendlineFailure: null,
      weakCountermoveScore: 84,
      wrongSidedTrader: null,
    } as any,
    wrongSidedTrader: {
      confidence: 86,
      confirmationStrength: 88,
      failedLevel: 'openingRangeLow',
      failedLevelPrice: 7440,
      likelyStopZone: 7436,
      reason: 'Vendedores atrapados.',
      reclaimOrRejectPrice: 7444,
      trapType: 'BEAR_TRAP',
      trappedSide: 'SELLERS',
      wrongSidedState: 'SELLERS_TRAPPED',
    } as any,
  }
}

function simulate(
  id: TraderVideoScenarioId,
  expectedDecision: TraderVideoAnalyticalFinalDecision,
  input: TraderVideoAnalyticalAgentInput,
): TraderVideoScenarioSimulation {
  const decision = analyzeTraderVideoEntry(input)
  const authority = buildTraderVideoAgentAuthority(decision)
  return {
    agentDecision: decision.finalDecision,
    canOpenTactically: authority.canOpenTactically,
    expectedDecision,
    id,
    passed: decision.finalDecision === expectedDecision,
    reason: decision.humanReasoning,
    tacticalBlockers: decision.blockedReasons,
  }
}

export function runTraderVideoScenarioSimulation(now = new Date()): TraderVideoScenarioSimulationStatus {
  const acceptedBreakout = validShort({
    openingRange: {
      ...baseOpeningRange,
      fakeBreakAbove: false,
      fakeBreakBelow: false,
      firstImpulseDirection: 'UP',
      openingRangeDirection: 'UP',
      reactionAtPreviousLevels: false,
      state: 'OPENING_RANGE_COMPLETED',
    } as any,
    weakCountermove: null,
    wrongSidedTrader: null,
  })
  const twoPointTrendline = validShort({
    trendlineFailure: {
      attemptedRecoveryCount: 0,
      canUseForEntry: false,
      direction: 'SHORT',
      reason: 'Solo dos puntos; no hay retest final.',
      state: 'TRENDLINE_ACTIVE',
      trendline: trendline(2, 'RISING_SUPPORT'),
    } as any,
  })
  const lowRiskReward = validShort({
    redGreenBox: {
      greenBoxReward: 5,
      redBoxRisk: 4,
      riskReward: rr(1.25),
      state: 'BLOCKED_RR_BELOW_2',
      structuralTarget: 7435,
      technicalStop: 7444,
    } as any,
    structuralRiskReward: rr(1.25) as any,
  })
  const scenarios = [
    simulate('BUYERS_TRAPPED_VALID_SHORT', 'GOOD_ENTRY', validShort()),
    simulate('SELLERS_TRAPPED_VALID_LONG', 'GOOD_ENTRY', validLong()),
    simulate('BREAKOUT_ACCEPTED_NO_TRADE', 'NO_TRADE', acceptedBreakout),
    simulate('TWO_POINT_TRENDLINE_BLOCKED', 'NO_TRADE', twoPointTrendline),
    simulate('RR_BELOW_2_BLOCKED', 'NO_TRADE', lowRiskReward),
  ]
  const failedScenarios = scenarios.filter((scenario) => !scenario.passed)
  const passedScenarios = scenarios.length - failedScenarios.length
  return {
    failedScenarios,
    mode: 'TRADER_VIDEO_SCENARIO_SIMULATOR',
    passedScenarios,
    scenarios,
    summary: failedScenarios.length
      ? `${failedScenarios.length} escenarios canonicos fallaron; revisar razonamiento del agente antes de la sesion.`
      : 'El agente responde correctamente a escenarios canonicos del metodo: short, long, no-trade, trendline incompleta y R/R bajo.',
    timestamp: now.toISOString(),
    totalScenarios: scenarios.length,
  }
}
