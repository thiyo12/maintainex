import { MatchCandidate, ScoreComponents } from './types'

export function rankCandidates(candidates: MatchCandidate[]): MatchCandidate[] {
  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.components.capability !== a.components.capability) {
      return b.components.capability - a.components.capability
    }
    if (b.components.reliability !== a.components.reliability) {
      return b.components.reliability - a.components.reliability
    }
    if (a.providerId < b.providerId) return -1
    if (a.providerId > b.providerId) return 1
    return 0
  })

  return sorted.map((c, i) => ({ ...c, rank: i + 1 }))
}
