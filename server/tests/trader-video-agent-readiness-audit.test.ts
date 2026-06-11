import { auditTraderVideoAgentReadiness } from '../strategy/traderVideoAgentReadinessAudit.js'
import { buildTraderVideoLearningCorpus } from '../strategy/traderVideoLearningCorpus.js'
import { buildTraderVideoMethodDoctrine } from '../strategy/traderVideoMethodDoctrine.js'
import { buildTraderVideoReplicationMode } from '../strategy/traderVideoReplicationMode.js'
import { assert, done } from './assert.js'

const now = new Date('2026-06-11T13:00:00.000Z')
const status = buildTraderVideoReplicationMode({ now })
const doctrine = buildTraderVideoMethodDoctrine({ now, status })
const corpus = buildTraderVideoLearningCorpus(now)
const audit = auditTraderVideoAgentReadiness({
  corpus,
  doctrine,
  journal: {
    journalPath: 'memory',
    lastObservation: null,
    observations: [],
    observationsToday: 0,
    totalObservations: 0,
    totalStoredObservations: 0,
    validationWindowDays: 3,
    validationWindowStart: '2026-06-08T13:00:00.000Z',
  },
  learningScore: {
    agentMaturity: 'OBSERVING',
    canLearnStrong: false,
    doctrineScore: 100,
    memoryScore: 20,
    outcomeScore: 0,
    reasoningScore: 70,
    recommendation: 'KEEP_OBSERVING',
    summary: 'Observando.',
    totalScore: 70,
  },
  now,
})

assert(audit.mode === 'TRADER_VIDEO_AGENT_READINESS_AUDIT', 'Debe crear auditoria de readiness del agente.')
assert(audit.readinessScore >= 90, 'Con doctrina completa y biblioteca experta debe quedar alto.')
assert(audit.status === 'OBSERVING_ONLY', 'Sin aprendizaje fuerte debe observar, no declarar tuning verificado.')
assert(audit.recommendation === 'KEEP_OBSERVING', 'Debe seguir observando hasta tener outcomes verificados.')
assert(audit.capabilities.some((item) => item.id === 'SP500_FUTURES_NO_CFD' && item.passed), 'Debe validar S&P futures/no-CFD.')
assert(audit.capabilities.some((item) => item.id === 'NY_TIME_WINDOWS' && item.passed), 'Debe validar ventanas NY.')
assert(audit.capabilities.some((item) => item.id === 'THREE_POINT_TRENDLINE' && item.passed), 'Debe validar trendline de tres puntos.')
assert(audit.capabilities.some((item) => item.id === 'RR_MINIMUM_2' && item.passed), 'Debe validar R/R minimo 1:2.')
assert(audit.capabilities.some((item) => item.id === 'ORDERFLOW_CONFIRMATION_ONLY' && item.passed && !item.required), 'Orderflow debe ser confirmacion no obligatoria.')
assert(audit.capabilities.some((item) => item.id === 'KNOWLEDGE_CANNOT_OPEN_TRADES' && item.passed), 'Conocimiento no puede abrir trades.')
assert(audit.blockingGaps.length === 0, 'No debe tener gaps de doctrina cuando todo esta cargado.')

const brokenAudit = auditTraderVideoAgentReadiness({
  corpus,
  doctrine,
  journal: {
    journalPath: 'memory',
    lastObservation: null,
    observations: [],
    observationsToday: 0,
    totalObservations: 0,
    totalStoredObservations: 0,
    validationWindowDays: 30,
    validationWindowStart: '2026-05-12T13:00:00.000Z',
  },
  learningScore: {
    agentMaturity: 'RULE_BASED',
    canLearnStrong: false,
    doctrineScore: 100,
    memoryScore: 0,
    outcomeScore: 0,
    reasoningScore: 0,
    recommendation: 'COLLECT_MORE_SETUPS',
    summary: 'Insuficiente.',
    totalScore: 10,
  },
  now,
})
assert(brokenAudit.status === 'NOT_READY_METHOD_GAPS', 'Si no valida ultimos 3 dias debe bloquear readiness.')
assert(brokenAudit.blockingGaps.some((item) => item.includes('LAST_THREE_DAYS_VALIDATION')), 'Debe explicar gap de ventana de validacion.')

done('trader-video-agent-readiness-audit')
