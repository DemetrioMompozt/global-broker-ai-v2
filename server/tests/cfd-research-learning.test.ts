import { assert, done } from './assert.js'

process.env.OPENAI_API_KEY = ''
process.env.CFD_RESEARCH_ENABLED = 'true'
process.env.CFD_RESEARCH_MODEL = 'gpt-5.5'
process.env.CFD_RESEARCH_WEB_SEARCH_ENABLED = 'true'

const research = await import('../performance/cfdResearchLearningAgent.js')

const status = research.getCfdResearchLearningStatus()
assert(status.enabled === true, 'research learning should be enabled by default')
assert(status.configured === false, 'missing OPENAI_API_KEY should be reported as not configured')
assert(status.status === 'NOT_CONFIGURED', 'missing OPENAI_API_KEY should not call OpenAI')
assert(status.model === 'gpt-5.5', 'research model should default to gpt-5.5')
assert(status.safety.paperOnly === true, 'research safety should be paper only')
assert(status.safety.canOpenTrades === false, 'research agent must not open trades')
assert(status.safety.canCloseTrades === false, 'research agent must not close trades')
assert(status.safety.canSendOrders === false, 'research agent must not send orders')
assert(status.safety.realTradingAllowed === false, 'real trading must stay false')
assert(status.safety.brokerExecutionEnabled === false, 'broker execution must stay false')

const manual = await research.runCfdResearchLearningNow('test')
assert(manual.status === 'NOT_CONFIGURED', 'manual research should not run without OPENAI_API_KEY')
assert(!JSON.stringify(manual).includes('sk-'), 'research status must not expose API keys')

done('cfd-research-learning')
