import type { MethodLearningScoreStatus } from './methodLearningScore.js'
import type { TraderVideoLearningCorpusStatus } from './traderVideoLearningCorpus.js'
import type { TraderVideoMethodDoctrineStatus } from './traderVideoMethodDoctrine.js'
import type { TraderVideoSetupJournalStatus } from './traderVideoSetupJournal.js'

export type TraderVideoAgentReadinessCapabilityId =
  | 'VIDEO_METHOD_PRIMARY'
  | 'SP500_FUTURES_NO_CFD'
  | 'NY_TIME_WINDOWS'
  | 'M30_MARKS_ONLY'
  | 'M1_EXECUTION_ONLY'
  | 'OPENING_RANGE_15M'
  | 'TRAPPED_TRADER_LOGIC'
  | 'THREE_POINT_TRENDLINE'
  | 'BREAK_AND_FAILED_RETEST'
  | 'RR_MINIMUM_2'
  | 'ORDERFLOW_CONFIRMATION_ONLY'
  | 'LAST_THREE_DAYS_VALIDATION'
  | 'KNOWLEDGE_CANNOT_OPEN_TRADES'

export type TraderVideoAgentReadinessCapability = {
  evidence: string
  id: TraderVideoAgentReadinessCapabilityId
  passed: boolean
  required: boolean
}

export type TraderVideoAgentReadinessAuditStatus = {
  blockingGaps: string[]
  capabilities: TraderVideoAgentReadinessCapability[]
  mode: 'TRADER_VIDEO_AGENT_READINESS_AUDIT'
  recommendation: 'READY_FOR_SUPERVISED_PAPER_OBSERVATION' | 'KEEP_OBSERVING' | 'FIX_METHOD_GAPS'
  readinessScore: number
  status: 'READY_FOR_SUPERVISED_PAPER_OBSERVATION' | 'OBSERVING_ONLY' | 'NOT_READY_METHOD_GAPS'
  summary: string
  timestamp: string
}

function contains(items: string[], expected: string) {
  const needle = expected.toLowerCase()
  return items.some((item) => item.toLowerCase().includes(needle))
}

function topic(corpus: TraderVideoLearningCorpusStatus, expected: string) {
  return corpus.expertKnowledgeBase.principles.some((principle) => principle.topic === expected)
}

function sourceInstitution(corpus: TraderVideoLearningCorpusStatus, expected: string) {
  return corpus.expertKnowledgeBase.principles
    .flatMap((principle) => principle.sources)
    .some((source) => source.institution.toLowerCase().includes(expected.toLowerCase()))
}

function capability(
  id: TraderVideoAgentReadinessCapabilityId,
  passed: boolean,
  evidence: string,
  required = true,
): TraderVideoAgentReadinessCapability {
  return { evidence, id, passed, required }
}

export function auditTraderVideoAgentReadiness(input: {
  corpus: TraderVideoLearningCorpusStatus
  doctrine: TraderVideoMethodDoctrineStatus
  journal: TraderVideoSetupJournalStatus
  learningScore: MethodLearningScoreStatus
  now?: Date
}): TraderVideoAgentReadinessAuditStatus {
  const now = input.now ?? new Date()
  const hardRules = input.doctrine.hardRules
  const extractedRules = input.corpus.extractedRules
  const safetyBoundary = input.corpus.expertKnowledgeBase.safetyBoundary
  const capabilities = [
    capability(
      'VIDEO_METHOD_PRIMARY',
      input.corpus.expertKnowledgeBase.primaryMethodSource === 'USER_VIDEO_AND_INSTRUCTIONS',
      'El video y las instrucciones del usuario son la fuente tactica principal.',
    ),
    capability(
      'SP500_FUTURES_NO_CFD',
      topic(input.corpus, 'SP500_FUTURES_MARKET_STRUCTURE') && contains(hardRules, 'no-CFD'),
      'Biblioteca con CME ES/MES y regla dura de no operar CFD dentro del metodo.',
    ),
    capability(
      'NY_TIME_WINDOWS',
      topic(input.corpus, 'SESSION_TIMING') && input.doctrine.timezone === 'America/New_York' && contains(hardRules, '16:00 NY'),
      'El reloj del metodo es New York: preparacion, opening range, ventana principal y cierre 16:00.',
    ),
    capability(
      'M30_MARKS_ONLY',
      contains(extractedRules, 'M30 solo sirve para pintar lineas') && contains(hardRules, 'M30'),
      'M30 se usa para marcas previas/pivotes, no para decidir entrada.',
    ),
    capability(
      'M1_EXECUTION_ONLY',
      contains(extractedRules, 'M1 para operar') || contains(hardRules, 'M1'),
      'La lectura fina y ejecucion se hacen en M1.',
    ),
    capability(
      'OPENING_RANGE_15M',
      topic(input.corpus, 'OPENING_RANGE_AND_AUCTION') && contains(extractedRules, 'primeros 15 minutos'),
      'El agente conoce ORH/ORL 09:30-09:45 y no opera antes de completarlos.',
    ),
    capability(
      'TRAPPED_TRADER_LOGIC',
      topic(input.corpus, 'TRAPPED_TRADER_LOGIC') && contains(extractedRules, 'quien quedo mal jugado'),
      'Primero se determina compradores/vendedores atrapados; despues se busca entrada.',
    ),
    capability(
      'THREE_POINT_TRENDLINE',
      contains(hardRules, 'tres puntos') && contains(input.doctrine.steps.map((step) => step.title), 'Trendline'),
      'Trendline valida requiere tres puntos limpios sobre el contramovimiento debil.',
    ),
    capability(
      'BREAK_AND_FAILED_RETEST',
      contains(extractedRules, 'ruptura de trendline') && contains(extractedRules, 'fallo'),
      'El gatillo exige ruptura de trendline y fallo de recuperacion.',
    ),
    capability(
      'RR_MINIMUM_2',
      topic(input.corpus, 'RISK_AND_EXECUTION') && contains(hardRules, '1:2'),
      'La caja roja/verde exige risk/reward minimo 1:2.',
    ),
    capability(
      'ORDERFLOW_CONFIRMATION_ONLY',
      topic(input.corpus, 'ORDERFLOW_CONFIRMATION')
        && input.corpus.expertKnowledgeBase.principles.some((principle) => principle.id === 'orderflow-is-confirmation-not-trigger'),
      'Bookmap/orderflow confirma liquidez/agresores; no reemplaza el metodo visual.',
      false,
    ),
    capability(
      'LAST_THREE_DAYS_VALIDATION',
      input.journal.validationWindowDays === 3,
      `La memoria operativa valida solo ${input.journal.validationWindowDays} dias recientes.`,
    ),
    capability(
      'KNOWLEDGE_CANNOT_OPEN_TRADES',
      contains(safetyBoundary, 'no abre trades') && contains(safetyBoundary, 'KillSwitch'),
      'El conocimiento alimenta criterio; no puede abrir trades ni saltarse safety.',
    ),
  ]
  const required = capabilities.filter((item) => item.required)
  const passedRequired = required.filter((item) => item.passed)
  const blockingGaps = required
    .filter((item) => !item.passed)
    .map((item) => `${item.id}: ${item.evidence}`)
  const sourceQuality = sourceInstitution(input.corpus, 'CME Group') && sourceInstitution(input.corpus, 'NYSE') ? 10 : 0
  const readinessScore = Math.round(Math.min(100, (passedRequired.length / required.length) * 90 + sourceQuality))
  const status: TraderVideoAgentReadinessAuditStatus['status'] = blockingGaps.length
    ? 'NOT_READY_METHOD_GAPS'
    : input.learningScore.canLearnStrong
      ? 'READY_FOR_SUPERVISED_PAPER_OBSERVATION'
      : 'OBSERVING_ONLY'
  const recommendation: TraderVideoAgentReadinessAuditStatus['recommendation'] = blockingGaps.length
    ? 'FIX_METHOD_GAPS'
    : input.learningScore.canLearnStrong
      ? 'READY_FOR_SUPERVISED_PAPER_OBSERVATION'
      : 'KEEP_OBSERVING'

  return {
    blockingGaps,
    capabilities,
    mode: 'TRADER_VIDEO_AGENT_READINESS_AUDIT',
    recommendation,
    readinessScore,
    status,
    summary: blockingGaps.length
      ? `Faltan ${blockingGaps.length} capacidades canonicas antes de confiar en el agente.`
      : `Agente preparado como observador/decisor supervisado del metodo; madurez=${input.learningScore.agentMaturity}, aprendizaje fuerte=${input.learningScore.canLearnStrong}.`,
    timestamp: now.toISOString(),
  }
}
