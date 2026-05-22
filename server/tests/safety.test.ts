import { safetyConfig } from '../config/safetyConfig.js'
import { getKillSwitchStatus } from '../risk/killSwitch.js'
import { getVtMarketsStatus } from '../broker/vtMarketsConnector.js'
import { assert, done } from './assert.js'

assert(safetyConfig.paperOnly, 'paperOnly must be true.')
assert(!safetyConfig.realTradingAllowed, 'realTradingAllowed must default false.')
assert(!safetyConfig.brokerExecutionEnabled, 'brokerExecutionEnabled must default false.')
assert(!safetyConfig.liveTradingEnabled, 'liveTradingEnabled must default false.')
assert(!safetyConfig.mt5RealExecution, 'MT5 real execution must default false.')
assert(getKillSwitchStatus().status === 'CLEAR', 'KillSwitch should be clear with safe defaults.')
const vt = await getVtMarketsStatus()
assert(vt.realTradingAllowed === false, 'VT real trading must be false.')
assert(
  vt.status === 'NOT_CONFIGURED'
    || vt.status === 'CONFIGURED_BUT_DISCONNECTED'
    || vt.status === 'CONNECTED_DEMO_READ_ONLY'
    || vt.status === 'ERROR'
    || vt.status === 'BLOCKED_BY_SAFETY',
  'VT can be safely not configured or read-only.',
)
done('safety')
