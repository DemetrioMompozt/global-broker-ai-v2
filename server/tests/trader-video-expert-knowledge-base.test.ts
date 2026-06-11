import { buildTraderVideoExpertKnowledgeBase } from '../strategy/traderVideoExpertKnowledgeBase.js'
import { assert, done } from './assert.js'

const knowledge = buildTraderVideoExpertKnowledgeBase(new Date('2026-06-11T05:00:00.000Z'))

assert(knowledge.mode === 'TRADER_VIDEO_EXPERT_KNOWLEDGE_BASE', 'Debe construir la base experta del agente.')
assert(knowledge.primaryMethodSource === 'USER_VIDEO_AND_INSTRUCTIONS', 'El video/instrucciones deben seguir siendo la fuente principal.')
assert(knowledge.principles.length >= 8, 'Debe consolidar principios expertos suficientes.')
assert(knowledge.principles.some((item) => item.topic === 'SP500_FUTURES_MARKET_STRUCTURE'), 'Debe incluir estructura de futuros S&P.')
assert(knowledge.principles.some((item) => item.topic === 'SESSION_TIMING' && item.appliedToVideoMethod.includes('09:30')), 'Debe incluir horario NY 09:30.')
assert(knowledge.principles.some((item) => item.topic === 'CANDLE_CONTEXT' && item.prohibitedUse.includes('vela aislada')), 'Debe impedir senales por vela aislada.')
assert(knowledge.principles.some((item) => item.topic === 'ORDERFLOW_CONFIRMATION' && item.prohibitedUse.includes('reemplazar')), 'Orderflow debe ser confirmacion, no reemplazo.')
assert(knowledge.principles.some((item) => item.topic === 'RISK_AND_EXECUTION' && item.appliedToVideoMethod.includes('1:2')), 'Debe exigir R/R minimo 1:2.')
assert(knowledge.principles.flatMap((item) => item.sources).some((source) => source.institution === 'CME Group'), 'Debe usar CME como fuente primaria.')
assert(knowledge.principles.flatMap((item) => item.sources).some((source) => source.institution === 'NYSE'), 'Debe usar NYSE para la hora cash.')
assert(knowledge.safetyBoundary.some((item) => item.includes('no abre trades')), 'La biblioteca no puede abrir trades.')
assert(knowledge.safetyBoundary.some((item) => item.includes('KillSwitch')), 'La biblioteca no puede saltarse safety.')

done('trader-video-expert-knowledge-base')
