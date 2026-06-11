import {
  detectTrappedTraders,
  type ProfessionalOpeningBar,
  type ProfessionalOpeningLevels,
  type TrappedTraderResult,
} from './trappedTraderDetector.js'

export type WrongSidedTraderResult = TrappedTraderResult & {
  wrongSidedState: 'BUYERS_TRAPPED' | 'SELLERS_TRAPPED' | 'NONE'
}

export function detectWrongSidedTraders(input: {
  bars: ProfessionalOpeningBar[]
  levels: ProfessionalOpeningLevels
}): WrongSidedTraderResult {
  const trap = detectTrappedTraders(input)
  return {
    ...trap,
    wrongSidedState: trap.trapType === 'BULL_TRAP'
      ? 'BUYERS_TRAPPED'
      : trap.trapType === 'BEAR_TRAP'
        ? 'SELLERS_TRAPPED'
        : 'NONE',
  }
}
