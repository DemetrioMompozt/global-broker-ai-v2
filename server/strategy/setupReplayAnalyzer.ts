import type { TraderVideoSetupObservation } from './traderVideoSetupJournal.js'

export type SetupReplayAnalyzerStatus = {
  blockedWithoutInteraction: number
  goodOrAcceptableSetups: number
  mostCommonMissingPiece: string
  replayQuality: 'INSUFFICIENT' | 'OBSERVING' | 'ACTIONABLE'
  reviewedSetups: number
  shortBiasSetups: number
  longBiasSetups: number
  topStates: Array<{ count: number; state: string }>
}

function topState(observations: TraderVideoSetupObservation[]) {
  const counts = new Map<string, number>()
  for (const item of observations) counts.set(item.state, (counts.get(item.state) ?? 0) + 1)
  return [...counts.entries()]
    .map(([state, count]) => ({ count, state }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5)
}

export function analyzeSetupReplay(observations: TraderVideoSetupObservation[]): SetupReplayAnalyzerStatus {
  const recent = observations.slice(0, 200)
  const blockedWithoutInteraction = recent.filter((item) => item.markInteractionScore < 60).length
  const goodOrAcceptableSetups = recent.filter((item) => item.analyticalDecision === 'GOOD_ENTRY' || item.analyticalDecision === 'ACCEPTABLE_ENTRY').length
  const shortBiasSetups = recent.filter((item) => item.bias === 'SHORT').length
  const longBiasSetups = recent.filter((item) => item.bias === 'LONG').length
  const mostCommonMissingPiece = blockedWithoutInteraction >= Math.max(1, recent.length * 0.35)
    ? 'Interaccion real con marcas'
    : goodOrAcceptableSetups === 0
      ? 'Historia completa del metodo'
      : 'Resultado posterior enlazado a cada setup'
  return {
    blockedWithoutInteraction,
    goodOrAcceptableSetups,
    longBiasSetups,
    mostCommonMissingPiece,
    replayQuality: recent.length >= 50
      ? 'ACTIONABLE'
      : recent.length >= 10
        ? 'OBSERVING'
        : 'INSUFFICIENT',
    reviewedSetups: recent.length,
    shortBiasSetups,
    topStates: topState(recent),
  }
}
