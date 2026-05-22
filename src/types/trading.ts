export type CfdPaperStatus = {
  mode: 'CFD_PAPER_TRADING_MODE' | 'DEFENSIVE_DIAGNOSTIC_MODE' | 'RECOVERY_PROBE_MODE'
  paperOnly: true
  realTradingAllowed: false
  brokerExecutionEnabled: false
  multiSourceTrading?: boolean
  limits?: {
    baseMaxOpenPositions: number
    maxBinanceCryptoOpenPositions: number
    maxTotalOpenPositions: number
    maxVtOpenPositions: number
  }
  sources?: {
    binance: { enabledForPaperSignals: boolean; openPositions: number; status: string }
    vtMarkets: { enabledForPaperSignals: boolean; openPositions: number; status: string }
  }
  agent: {
    status: 'RUNNING' | 'STOPPED' | 'WATCHING' | 'MANAGING'
    lastEvaluationAt: string | null
    nextEvaluationAt: string | null
    lastDecision: Record<string, unknown>
  }
  account: {
    balance: number
    equity: number
    openPnl: number
    closedPnl: number
    usedMargin: number
    freeMargin: number
    marginLevel: number
    portfolioLeverage: number
  }
  openPositions: CfdPosition[]
  opportunities: Opportunity[]
  blockedOpportunities: Array<{ cfdSymbol: string; reason: string }>
  activityFeed: ActivityItem[]
  feeds: {
    binance: { status: string; lastUpdate: string | null; symbols: string[] }
    alpaca: { status: string }
    finnhub: { status: string }
  }
  cfdExpert: {
    enabled: boolean
    mode: 'PAPER_ONLY'
    lastEvaluation: CfdExpertEvaluation | null
  }
  performance: {
    trades: number
    grossProfit: number
    grossLoss: number
    netProfit: number
    profitFactor: number
    profitFactorDisplay?: string
    sampleSizeReason?: string
    sampleSizeStatus?: 'INSUFFICIENT_SAMPLE' | 'SUFFICIENT_SAMPLE'
    winRate: number
    expectedPayoff: number
    drawdown: number
    recoveryFactor: number
  }
  microProfit: MicroProfitStatus
  agentEffectiveness: AgentEffectivenessStatus
  defensiveDiagnostic: DefensiveDiagnosticStatus
  lossAttribution: LossAttributionStatus
  targetFeasibility: TargetFeasibilityStatus
  leverageDamage: LeverageDamageStatus
  adaptiveLearning: AdaptiveLearningStatus
  cfdResearchLearning: CfdResearchLearningStatus
  cfdTraderSkill: CfdTraderSkillStatus
  traderDecision: TraderDecisionStatus
  vtMarkets: {
    broker: string
    platform: string
    mode: string
    readOnly: true
    enabled: boolean
    connected: boolean
    accountType: 'MT5_DEMO' | 'UNKNOWN' | 'REAL_BLOCKED'
    loginMasked: string
    server: string
    orderSendAllowed: boolean
    realTradingAllowed: false
    status: 'NOT_CONFIGURED' | 'CONFIGURED_BUT_DISCONNECTED' | 'CONNECTED_DEMO_READ_ONLY' | 'ERROR' | 'BLOCKED_BY_SAFETY'
    warnings: string[]
    account: {
      balance: number | null
      equity: number | null
      freeMargin: number | null
      usedMargin: number | null
      marginLevel: number | null
    }
    symbolsMapped: number
  }
  safety: {
    realTradingAllowed: false
    brokerExecutionEnabled: false
    killSwitchStatus: 'CLEAR' | 'TRIGGERED'
  }
  serverTime: string
}

export type CfdPosition = {
  id: string
  cfdSymbol: string
  underlyingSymbol: string
  source?: 'BINANCE_REALTIME' | 'VT_MARKETS_MT5_DEMO'
  assetClass?: string
  direction: 'LONG' | 'SHORT'
  strategy: string
  entryPrice: number
  currentPrice: number
  currentAsk?: number
  currentBid?: number
  previousPrice: number
  stopLoss: number
  takeProfit: number
  positionSize: number
  riskPercent: number
  riskUsd: number
  marginRequired: number
  leverage: number
  spreadAtEntry: number
  spreadCost?: number
  commission?: number
  slippageEstimate?: number
  swapAccrued?: number
  totalEstimatedCost?: number
  costToProfitRatio?: number
  microTargetNetUsd?: number
  grossPnl?: number
  netPnl?: number
  openPnl: number
  bestOpenPnl?: number
  openPnlPercent: number
  provider: string
  feedType: string
  openedAt: string
  lastBrokerTickTime?: string | null
  lastPriceUpdate: string
  thesis: string
  cfdExpertScore: number
  cfdExpertReason: string
  professionalSkillScore?: number
  professionalSkillReason?: string
  candleBehaviorScoreAtEntry?: number
  candlePatternAtEntry?: string
  minimumMoveNeeded?: number
  minimumMoveBps?: number
  managementStatus: string
  nextAction: string
}

export type DefensiveDiagnosticStatus = {
  active: boolean
  mode: 'DEFENSIVE_DIAGNOSTIC_MODE' | 'RECOVERY_PROBE_MODE'
  states: string[]
  reason: string
  newEntriesBlocked: boolean
  newRiskUsd: number
  reactivationRiskUsd: number
  maxReactivationLeverage: number
  maxReactivationOpenPositions: number
  microProfitSuspended: boolean
}

export type SymbolDiagnostic = {
  avgLoss: number
  avgWin: number
  costToProfitRatio: number
  grossLoss: number
  grossProfit: number
  maxDrawdown: number
  netPnl: number
  profitFactor: number | null
  spreadAvg: number
  status: 'KEEP' | 'WATCH' | 'SUSPEND' | 'BAN_FOR_SESSION'
  symbol: string
  trades: number
  winRate: number
}

export type LossAttributionStatus = {
  correlationImpact: number
  costImpact: number
  leverageImpact: number
  mainLossDriver: string
  recommendations: string[]
  symbolDiagnostics: SymbolDiagnostic[]
  worstDirections: Array<{ name: string; netPnl: number; trades: number }>
  worstStrategies: Array<{ name: string; netPnl: number; trades: number }>
  worstSymbols: SymbolDiagnostic[]
}

export type TargetFeasibilityStatus = {
  avgCostToProfitRatio: number
  avgMoveNeededBps: number
  avgTimeToTargetSeconds: number | null
  targetHitRate: number
  targetNetUsd: number
  viable: boolean
  verdict: string
}

export type LeverageDamageStatus = {
  averageLeverage: number
  drawdownAmplified: boolean
  leveragedLossImpact: number
  marginStressClosures: number
  recommendation: string
}

export type AdaptiveLearningStatus = {
  lastUpdated: string
  learningScore: number
  status: 'OBSERVING' | 'PROTECTING' | 'ADAPTING' | 'READY_TO_TEST'
  sampleSize: number
  netPnlToday: number
  openPositions: number
  mainLesson: string
  mainProblem: string
  worstClosureReason: { reason: string; count: number; netPnl: number } | null
  winningPatterns: Array<{
    avgNetPnl: number
    avgTimeToCloseSeconds: number
    candlePattern: string | null
    direction: string
    evidence: string
    key: string
    sampleSize: number
    scoreBoost: number
    source: string
    strategy: string
    symbol: string
    targetHitRate: number
    whyItWorked: string
  }>
  preferredSetups: Array<{
    candlePattern: string | null
    direction: string
    reason: string
    scoreBoost: number
    source: string
    strategy: string
    symbol: string
  }>
  rules: Array<{
    action: string
    applied: boolean
    evidence: string
    id: string
    severity: string
    solution: string
    target?: string
    unlockCondition: string
  }>
  solutions: string[]
  nextExperiment: string
}

export type CfdResearchLearningStatus = {
  enabled: boolean
  configured: boolean
  model: string
  webSearchEnabled: boolean
  status: 'NOT_CONFIGURED' | 'DISABLED' | 'IDLE' | 'RUNNING' | 'READY' | 'ERROR'
  lastRunAt: string | null
  nextRunAt: string | null
  trigger: string | null
  summary: string
  techniquesResearched: string[]
  hypotheses: string[]
  candleLessons: string[]
  ruleProposals: Array<{
    confidence: 'LOW' | 'MEDIUM' | 'HIGH'
    evidence: string
    proposedRule: string
    reason: string
    validationPlan: string
  }>
  riskWarnings: string[]
  nextExperiment: string
  operationalPolicy: string
  safety: {
    paperOnly: true
    canOpenTrades: false
    canCloseTrades: false
    canSendOrders: false
    realTradingAllowed: false
    brokerExecutionEnabled: false
  }
  error?: string
}

export type MicroProfitStatus = {
  mode: 'MICRO_PROFIT_CFD_DEMO_MODE'
  enabled: boolean
  targetNetUsd: 1 | 2 | 3
  targetOptionsUsd: Array<1 | 2 | 3>
  defaultTargetUsd: 1 | 2 | 3
  recommendedTargetUsd: number
  limits: {
    cooldownAfterLossSeconds: number
    cooldownAfterWinSeconds: number
    dailyStopLossUsd: number
    dailyTargetUsd: number
    maxConcurrentSymbols: number
    maxConsecutiveLosses: number
    maxDailyTrades: number
    maxHoldSeconds: number
    maxLossPerTradeUsd: number
    maxOpenPositions: number
    maxTradesPerHour: number
  }
  costLimits: {
    maxCostToProfitRatio: number
    maxSpreadCostUsd: number
    maxTotalEstimatedCostUsd: number
  }
  tradesToday: number
  netProfitToday: number
  averageNetWin: number
  averageNetLoss: number
  costToProfitRatio: number
  profitFactor: number
  expectedPayoff: number
}

export type TraderDecisionStatus = {
  accountHealth: 'HEALTHY' | 'DEFENSIVE' | 'MARGIN_WARNING' | 'CRITICAL_MARGIN_DEFENSIVE'
  action: 'Hold all' | 'Close weak position' | 'Reduce exposure' | 'Wait for margin recovery' | 'Open new opportunity'
  bestOpportunity: string | null
  blockNewEntries: boolean
  maxAllowedOpenPositions: number
  reason: string
  weakestPosition: {
    action: string
    capitalEfficiencyScore: number
    cfdSymbol: string
    marginEfficiencyScore: number
    openPnl: number
    positionQualityScore: number
    reason: string
  } | null
}

export type AgentEffectivenessStatus = {
  averageNetLoss: number
  averageNetWin: number
  averageTimeToTargetSeconds: number | null
  closedByLossToday: number
  closedByRotationToday: number
  closedByStaleToday: number
  closedPnl: number
  closedToday: number
  expectedPayoff: number
  minFreeMargin: number
  minMarginLevel: number
  netProfitToday: number
  openPnl: number
  openPositions: number
  opportunitiesBlocked: number
  principalBlockingReason: string | null
  principalClosureReason: string | null
  profitFactor: number | null
  profitFactorDisplay: string
  reason: string
  rotationsToday: number
  score: number
  staleClosuresToday: number
  stalePositions: number
  status: 'MEASURING' | 'EFFECTIVE' | 'WATCH' | 'WEAK' | 'CORRECTIVE' | 'INEFFICIENT'
  targetHitsToday: number
  winRate: number
}

export type CfdTraderSkillStatus = {
  actionsTaken: TraderSkillAction[]
  blockedActions: TraderSkillAction[]
  changeOfMindTrigger: string
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  executableActions: TraderSkillAction[]
  headline: string
  mode: 'HUNTING' | 'MANAGING' | 'ROTATING' | 'DEFENSIVE' | 'MEASURING'
  reading: string
  riskWarning: string
  riskWatched: string | null
  strongestOpportunity: {
    cfdSymbol: string
    expectedNetProfit: number
    reason: string
    score: number
    spreadBps: number
  } | null
  suggestedActions: TraderSkillAction[]
  surpriseMove: string
  surprisePlay: string
  tacticalPlan: string[]
  tacticalPlanText: string
  thesis: string
  weakestPosition: {
    ageMinutes: number
    cfdSymbol: string
    openPnl: number
    reason: string
  } | null
  whatWouldChangeMind: string
}

export type TraderSkillAction = {
  type: string
  symbol?: string
  reason: string
}

export type Opportunity = {
  cfdSymbol: string
  underlyingSymbol: string
  source?: 'BINANCE_REALTIME' | 'VT_MARKETS_MT5_DEMO'
  assetClass?: string
  cfdExpertScore?: number
  decision?: string
  direction?: 'LONG' | 'SHORT'
  expectedNetProfit?: number
  candleBehavior?: {
    signal?: string
    score?: number
    pattern?: string
    reason?: string
    timeframe?: string
  }
  candleBehaviorScore?: number
  candlePattern?: string
  learningAdjustedScore?: number
  learningBias?: number
  learningReason?: string
  price?: number
  riskReward?: number
  score: number
  spread?: number
  spreadBps?: number
  strategy: string
  timeframe: string
  setupStatus: string
  cfdExpertDecision: string
  reason: string
  provider: string
  feedType: string
}

export type CfdExpertEvaluation = {
  cfdSymbol: string
  underlyingSymbol: string
  decision: string
  expertScore: number
  riskLevel: string
  pricingQuality: string
  spreadAssessment: string
  marginAssessment: string
  leverageAssessment: string
  sessionAssessment: string
  reason: string
  blockingReasons: string[]
  recommendations: string[]
}

export type ActivityItem = {
  time: string
  action: string
  symbol?: string
  reason: string
  pnl?: number
}

export type VtAccount = {
  accountMode: 'DEMO' | 'UNKNOWN' | 'REAL'
  balance: number | null
  equity: number | null
  freeMargin: number | null
  login: string
  marginLevel: number | null
  server: string
  usedMargin: number | null
  status: string
}

export type VtSetupDiagnostics = {
  steps: Array<{
    id: string
    label: string
    status: 'pending' | 'completed' | 'error' | 'blocked'
    message: string
    missingVariables?: string[]
    unsafeVariables?: string[]
  }>
  bridgeEnv: BridgeEnvCheck
  mt5Bridge: {
    url: string
    reachable: boolean
    status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
    httpStatus: number | null
    raw?: unknown
  }
  vtMarkets: {
    enabled: boolean
    configured: boolean
    mode: 'DEMO'
    readOnly: true
    connected: boolean
    accountType: 'DEMO' | 'UNKNOWN' | 'REAL_BLOCKED'
    status: string
    account: VtAccount
  }
  safety: {
    paperOnly: true
    realTradingAllowed: false
    brokerExecutionEnabled: false
    orderSendAllowed: false
    readOnly: true
    killSwitchStatus: 'CLEAR' | 'TRIGGERED'
  }
  nextAction: string
}

export type BridgeEnvCheck = {
  exists: boolean
  loginMasked?: string
  valid: boolean
  missingVariables: string[]
  server?: string
  unsafeVariables: string[]
  presentVariables: string[]
  message: string
}

export type SaveBridgeEnvResponse = {
  ok: true
  envCreated: true
  path: string
  server: string
  loginMasked: string
  safety: {
    MT5_MODE: 'DEMO'
    MT5_READ_ONLY: true
    MT5_ALLOW_ORDER_SEND: false
    MT5_REAL_TRADING_ALLOWED: false
  }
  nextAction: string
}

export type VtMarketsConnectionWizardResult = {
  status: 'BLOCKED_REAL_ACCOUNT' | 'CONNECTED_DEMO_READ_ONLY' | 'ERROR' | 'INVALID_CREDENTIALS' | 'NEEDS_CONNECTOR' | 'NEEDS_MT5_LOGIN'
  userMessage: string
  account: VtAccount
  safety: {
    paperOnly: true
    realTradingAllowed: false
    brokerExecutionEnabled: false
    orderSendAllowed: false
    readOnly: true
    killSwitchStatus?: 'CLEAR' | 'TRIGGERED'
  }
  technical: {
    connector?: {
      attempted: boolean
      bridgeReachable: boolean
      detail?: string
      message: string
      pid?: number
      started: boolean
    } | null
    saved?: SaveBridgeEnvResponse
    envCheck?: BridgeEnvCheck
    bridge?: unknown
    vtStatus?: unknown
    symbolsCount?: number
    testTick?: VtTickResponse | null
  }
}

export type VtSymbolsResponse = {
  symbols: unknown[]
  status: string
}

export type VtMappingResponse = {
  mappings: Array<{
    internalSymbol: string
    brokerSymbol: string | null
    mappingStatus: 'MATCHED' | 'MULTIPLE_MATCHES' | 'NOT_FOUND'
    candidates: string[]
  }>
  note: string
}

export type VtTickResponse = {
  cfdSymbol?: string
  brokerSymbol?: string
  bid?: number
  ask?: number
  mid?: number
  spread?: number
  spreadBps?: number
  provider?: string
  feedType?: string
  pricingQuality?: string
  readOnly?: true
  reason?: string
  status?: string
}
