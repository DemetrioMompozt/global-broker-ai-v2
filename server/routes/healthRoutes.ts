import { Router } from 'express'
import { getSafetyConfig } from '../config/safetyConfig.js'
import { getKillSwitchStatus } from '../risk/killSwitch.js'

export const healthRouter = Router()

healthRouter.get('/', (_request, response) => {
  response.json({
    ok: true,
    app: 'global-broker-ai-v2',
    mode: 'CFD_PAPER_TRADING_MODE',
    paperOnly: true,
    realTradingAllowed: false,
    brokerExecutionEnabled: false,
    safety: getSafetyConfig(),
    killSwitch: getKillSwitchStatus(),
    timestamp: new Date().toISOString(),
  })
})
