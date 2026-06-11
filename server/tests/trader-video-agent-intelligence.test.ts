import { buildTraderVideoAgentIntelligence } from '../strategy/traderVideoAgentIntelligence.js'
import { recordTraderVideoSetupObservation, resetTraderVideoSetupJournalForTests } from '../strategy/traderVideoSetupJournal.js'
import { analyzeTraderVideoEntry } from '../strategy/traderVideoAnalyticalAgent.js'
import { assert, done } from './assert.js'

resetTraderVideoSetupJournalForTests()

const testNow = new Date()
const legacyOutsideWindow = new Date(testNow.getTime() - 4 * 24 * 60 * 60 * 1000)

recordTraderVideoSetupObservation({
  analyticalDecision: 'GOOD_ENTRY',
  bias: 'SHORT',
  blockedReasons: [],
  componentScores: {
    contextScore: 90,
    dataConfidenceScore: 90,
    institutionalPressureScore: 90,
    markInteractionScore: 90,
    redGreenScore: 90,
    retestFailureScore: 90,
    trappedTraderScore: 90,
    trendlineQualityScore: 90,
    candlestickConfirmationScore: 90,
    weakCountermoveScore: 90,
  },
  confidence: 90,
  createdAt: legacyOutsideWindow.toISOString(),
  id: 'legacy-outside-three-day-window',
  institutionalPressure: 'BEARISH',
  markInteractionScore: 90,
  narrative: 'Observacion vieja que no debe contaminar la validacion actual.',
  nextRequiredCondition: 'Fuera de ventana.',
  openingRangeHigh: 7452,
  openingRangeLow: 7440,
  outcome: {
    closeReason: null,
    pnlUsd: null,
    status: 'OBSERVED_ONLY',
  },
  reason: 'Fuera de ventana reciente.',
  redGreenBox: {
    costToTargetRatio: null,
    expectedNetProfit: null,
    greenBoxReward: null,
    redBoxRisk: null,
    state: null,
    structuralTarget: null,
    targetNetUsd: null,
    technicalStop: null,
  },
  retestFailure: {
    canUseForEntry: null,
    state: null,
  },
  riskRewardRatio: null,
  sessionDate: legacyOutsideWindow.toISOString().slice(0, 10),
  state: 'READY_FOR_PAPER_SHORT',
  symbol: 'SP500',
  testedLevelName: 'ORH',
  testedLevelPrice: 7452,
  trappedSide: 'BUYERS',
  trendlineQuality: {
    anchorCount: 3,
    qualityScore: 90,
    role: 'WEAK_BUYER_PULLBACK',
    slopePerMinute: 0.2,
  },
  trendlineState: 'RETEST_FAILED',
  weakCountermove: {
    counterMoveBars: 6,
    score: 90,
    state: 'WEAK_COUNTERMOVE_DETECTED',
  },
})

const analyticalDecision = analyzeTraderVideoEntry({
  dataQuality: {
    barsCount: 90,
    feedFresh: true,
    hasLevels: true,
    hasTimezoneClarity: true,
    marketClosed: false,
  },
  openingRange: {
    fakeBreakAbove: false,
    fakeBreakBelow: false,
    firstImpulseDirection: 'FLAT',
    firstImpulseStrength: 20,
    openingRangeDirection: 'FLAT',
    openingRangeHigh: 7452,
    openingRangeLow: 7440,
    openingRangeMid: 7446,
    openingRangeSize: 12,
    reactionAtPreviousLevels: false,
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
  sessionPhase: 'MAIN_WINDOW',
  symbol: 'SP500',
} as any)

const status = {
  analyticalDecision,
  bookmap: {},
  canPaperTrade: false,
  candidate: null,
  finalDecision: 'BLOCK',
  institutionalPressure: 'NEUTRAL',
  mode: 'TRADER_VIDEO_REPLICATION_MODE',
  movementNature: null,
  nextAction: analyticalDecision.nextRequiredCondition,
  openingRange: {
    fakeBreakAbove: false,
    fakeBreakBelow: false,
    firstImpulseDirection: 'FLAT',
    firstImpulseStrength: 20,
    openingRangeDirection: 'FLAT',
    openingRangeHigh: 7452,
    openingRangeLow: 7440,
    openingRangeMid: 7446,
    openingRangeSize: 12,
    reactionAtPreviousLevels: false,
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
  reason: analyticalDecision.humanReasoning,
  redGreenRiskBox: null,
  sp500ProfessionalOpening: {},
  state: 'OPENING_RANGE_MARKED',
  symbol: 'SP500',
  timestamp: '2026-06-05T14:00:00.000Z',
  trendlineFailure: null,
  weakCountermoveTrendline: null,
  wrongSidedTrader: null,
} as any

const intelligence = buildTraderVideoAgentIntelligence({
  bars: [
    { close: 100, high: 101, low: 99, open: 100, timestamp: '2026-06-05T13:46:00Z' },
    { close: 99.8, high: 100.8, low: 99.2, open: 100.1, timestamp: '2026-06-05T13:47:00Z' },
    { close: 99.4, high: 100.2, low: 99, open: 99.9, timestamp: '2026-06-05T13:48:00Z' },
    { close: 99.1, high: 99.8, low: 98.7, open: 99.5, timestamp: '2026-06-05T13:49:00Z' },
    { close: 98.9, high: 99.5, low: 98.5, open: 99.1, timestamp: '2026-06-05T13:50:00Z' },
    { close: 98.6, high: 99.2, low: 98.2, open: 98.9, timestamp: '2026-06-05T13:51:00Z' },
    { close: 98.3, high: 98.9, low: 98, open: 98.7, timestamp: '2026-06-05T13:52:00Z' },
    { close: 98, high: 98.5, low: 97.7, open: 98.4, timestamp: '2026-06-05T13:53:00Z' },
  ],
  now: testNow,
  traderVideoReplicationMode: status,
})

assert(intelligence.mode === 'TRADER_VIDEO_AGENT_INTELLIGENCE', 'Debe construir modo de inteligencia del agente.')
assert(intelligence.candleTrendContext.mode === 'CANDLE_TREND_CONTEXT_ENGINE', 'Debe incluir contexto experto de velas y tendencia.')
assert(intelligence.candleTrendContext.barsAnalyzed >= 8, 'Debe analizar velas cuando estan disponibles.')
assert(intelligence.learningCorpus.mode === 'TRADER_VIDEO_LEARNING_CORPUS', 'Debe cargar corpus de aprendizaje del video.')
assert(intelligence.learningCorpus.passAnalyses.length === 5, 'Debe registrar cinco pasadas de analisis del video/audio.')
assert(intelligence.learningCorpus.audioTranscript.segments === 500, 'Debe enlazar la transcripcion completa del audio.')
assert(intelligence.learningCorpus.extractedRules.some((item) => item.includes('opening range')), 'Debe extraer reglas tacticas del audio.')
assert(intelligence.learningCorpus.externalPrinciples.length >= 5, 'Debe incluir principios externos curados.')
assert(intelligence.learningCorpus.expertKnowledgeBase.mode === 'TRADER_VIDEO_EXPERT_KNOWLEDGE_BASE', 'Debe cargar biblioteca experta curada.')
assert(intelligence.learningCorpus.expertKnowledgeBase.curatedStudyLibrary.length >= 8, 'Debe cargar una biblioteca legal de estudio curado.')
assert(intelligence.learningCorpus.expertKnowledgeBase.curatedStudyLibrary.every((item) => item.legalUse.length > 10 && !item.source.url.includes('r-5.org')), 'La biblioteca debe guardar fuentes legales/resumidas, no PDFs sueltos de libros.')
assert(intelligence.learningCorpus.expertKnowledgeBase.primaryMethodSource === 'USER_VIDEO_AND_INSTRUCTIONS', 'La biblioteca debe dejar el video como fuente tactica principal.')
assert(intelligence.learningCorpus.expertKnowledgeBase.principles.some((item) => item.topic === 'SP500_FUTURES_MARKET_STRUCTURE'), 'Debe saber que el metodo es S&P futures/no-CFD.')
assert(intelligence.learningCorpus.expertKnowledgeBase.principles.some((item) => item.topic === 'ORDERFLOW_CONFIRMATION'), 'Debe incluir orderflow/bookmap como confirmacion.')
assert(intelligence.learningCorpus.expertKnowledgeBase.safetyBoundary.some((item) => item.includes('no abre trades')), 'El conocimiento no debe abrir trades por si solo.')
assert(intelligence.methodDoctrine.mode === 'TRADER_VIDEO_METHOD_DOCTRINE', 'Debe cargar doctrina del metodo del video.')
assert(intelligence.methodDoctrine.learnedFrom.some((item) => item.includes('Instrucciones del usuario')), 'Debe aprender de las instrucciones del usuario.')
assert(intelligence.methodDoctrine.hardRules.some((item) => item.includes('Risk/reward minimo 1:2')), 'Debe exigir R/R minimo 1:2.')
assert(intelligence.methodDoctrine.hardRules.some((item) => item.includes('No abrir despues de 16:00 NY')), 'Debe conocer limite operativo de 16:00 NY.')
assert(intelligence.methodDoctrine.steps.some((item) => item.id === 'THREE_POINT_TRENDLINE'), 'Debe incluir trendline de tres puntos como paso canonico.')
assert(intelligence.methodDoctrine.nextDoctrineStep?.id === 'WRONG_SIDED_TRADERS', 'Con OR listo, el siguiente paso debe ser detectar atrapados.')
assert(intelligence.morningBrief.mode === 'TRADER_VIDEO_MORNING_BRIEF', 'Debe generar brief operativo matutino.')
assert(intelligence.morningBrief.timezone === 'America/New_York', 'El brief debe operar con reloj New York.')
assert(intelligence.morningBrief.prohibitedActions.some((item) => item.includes('No abrir despues de 16:00 NY')), 'El brief debe recordar limite de cierre NY.')
assert(intelligence.readinessAudit.mode === 'TRADER_VIDEO_AGENT_READINESS_AUDIT', 'Debe auditar readiness del agente.')
assert(intelligence.readinessAudit.capabilities.some((item) => item.id === 'VIDEO_METHOD_PRIMARY' && item.passed), 'Debe validar que el video manda.')
assert(intelligence.readinessAudit.capabilities.some((item) => item.id === 'LAST_THREE_DAYS_VALIDATION' && item.passed), 'Debe validar ventana reciente de 3 dias.')
assert(intelligence.readinessAudit.capabilities.some((item) => item.id === 'KNOWLEDGE_CANNOT_OPEN_TRADES' && item.passed), 'Debe validar que conocimiento no abre trades.')
assert(intelligence.scenarioSimulation.mode === 'TRADER_VIDEO_SCENARIO_SIMULATOR', 'Debe practicar escenarios canonicos del metodo.')
assert(intelligence.scenarioSimulation.failedScenarios.length === 0, 'Los escenarios canonicos deben pasar.')
assert(intelligence.scenarioSimulation.scenarios.some((item) => item.id === 'RR_BELOW_2_BLOCKED' && item.agentDecision === 'NO_TRADE'), 'Debe rechazar R/R bajo en simulacion.')
assert(intelligence.experienceAgent.mode === 'TRADER_VIDEO_MARKET_EXPERIENCE_AGENT', 'Debe incluir agente de experiencia de mercado.')
assert(intelligence.experienceAgent.advisoryOnly === true, 'La experiencia no debe autorizar entradas ni saltarse safety.')
assert(intelligence.experienceAgent.legalCorpusStatus === 'LEGAL_SUMMARIES_ONLY', 'La experiencia debe depender de corpus legal resumido.')
assert(intelligence.learningScore.doctrineScore > 0, 'El score de aprendizaje debe incluir doctrina aprendida.')
assert(intelligence.chartNarrative.markInteraction.quality === 'NONE', 'Sin prueba/fallo de marcas no debe inventar interaccion.')
assert(intelligence.chartNarrative.missing.some((item) => item.includes('atrapados')), 'Debe explicar que faltan atrapados.')
assert(intelligence.setupJournal.totalObservations >= 1, 'Debe registrar al menos una observacion reciente de setup.')
assert(intelligence.setupJournal.totalStoredObservations >= intelligence.setupJournal.totalObservations, 'Debe conservar historial completo solo para auditoria.')
assert(intelligence.setupJournal.validationWindowDays === 3, 'La inteligencia debe validar solo los ultimos 3 dias.')
assert(intelligence.setupJournal.observations.every((item) => item.id !== 'legacy-outside-three-day-window'), 'La inteligencia no debe usar observaciones fuera de los ultimos 3 dias.')
assert(Array.isArray(intelligence.setupJournal.lastObservation?.blockedReasons), 'El journal debe guardar razones analiticas de bloqueo.')
assert(typeof intelligence.setupJournal.lastObservation?.componentScores.contextScore === 'number', 'El journal debe guardar scores por componente.')
assert(typeof intelligence.setupJournal.lastObservation?.nextRequiredCondition === 'string', 'El journal debe guardar la siguiente condicion necesaria.')
assert(intelligence.setupJournal.lastObservation?.riskRewardRatio !== undefined, 'El journal debe guardar R/R aunque sea null.')
assert(intelligence.setupJournal.lastObservation?.redGreenBox.state !== undefined, 'El journal debe guardar estado de rojo/verde.')
assert(intelligence.setupJournal.lastObservation?.trendlineQuality.anchorCount !== undefined, 'El journal debe guardar calidad de trendline.')
assert(intelligence.learningScore.agentMaturity === 'RULE_BASED', 'Sin memoria/outcomes suficientes sigue siendo rule based.')
assert(intelligence.learningScore.canLearnStrong === false, 'No puede aprender fuerte sin resultados enlazados.')
assert(intelligence.falsePositiveFalseNegativeAudit.status === 'NO_OUTCOME_DATA', 'No debe auditar FP/FN sin outcomes.')

done('trader-video-agent-intelligence')
