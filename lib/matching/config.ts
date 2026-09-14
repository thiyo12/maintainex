import { PrismaClient } from '@prisma/client'
import type { MatchingConfig, ScoreComponents, WaveConfig } from './types'

const DEFAULT_WEIGHTS: ScoreComponents = {
  capability: 30,
  reliability: 20,
  reputation: 20,
  availability: 15,
  travel: 10,
  experience: 5,
  fairness: 0,
  preferredSkill: 0,
}

const DEFAULT_CONFIG: MatchingConfig = {
  countryCode: 'GLOBAL',
  matchingVersion: 'v1',
  weights: { ...DEFAULT_WEIGHTS },
  wave1Size: 3,
  wave2Size: 5,
  wave3Size: 8,
  wave1ExpiryMinutes: 15,
  wave2ExpiryMinutes: 15,
  wave3ExpiryMinutes: 30,
  newProviderBaseline: 50,
  maxOpportunityBoost: 15,
}

export function validateWeights(weights: ScoreComponents): boolean {
  const sum = weights.capability + weights.reliability + weights.reputation +
    weights.availability + weights.travel + weights.experience +
    weights.fairness + weights.preferredSkill
  if (sum !== 100) return false
  for (const v of Object.values(weights)) {
    if (v < 0 || v > 100) return false
  }
  return true
}

export async function resolveMatchingConfig(
  client: PrismaClient,
  countryCode: string,
): Promise<MatchingConfig> {
  const row = await client.marketConfig.findUnique({ where: { countryCode } }).catch(() => null)
  const globalRow = countryCode !== 'GLOBAL'
    ? await client.marketConfig.findUnique({ where: { countryCode: 'GLOBAL' } }).catch(() => null)
    : null
  const cfg = row || globalRow
  if (!cfg) return { ...DEFAULT_CONFIG, countryCode }

  const weights: ScoreComponents = {
    capability: cfg.weightCapability,
    reliability: cfg.weightReliability,
    reputation: cfg.weightReputation,
    availability: cfg.weightAvailability,
    travel: cfg.weightTravel,
    experience: cfg.weightExperience,
    fairness: (cfg as any).weightFairness ?? 0,
    preferredSkill: (cfg as any).weightPreferredSkill ?? 0,
  }

  const resolvedWeights = validateWeights(weights) ? weights : { ...DEFAULT_WEIGHTS }

  return {
    countryCode,
    matchingVersion: cfg.matchingVersion || 'v1',
    weights: resolvedWeights,
    wave1Size: (cfg as any).wave1Size ?? 3,
    wave2Size: (cfg as any).wave2Size ?? 5,
    wave3Size: (cfg as any).wave3Size ?? 8,
    wave1ExpiryMinutes: (cfg as any).wave1ExpiryMinutes ?? 15,
    wave2ExpiryMinutes: (cfg as any).wave2ExpiryMinutes ?? 15,
    wave3ExpiryMinutes: (cfg as any).wave3ExpiryMinutes ?? 30,
    newProviderBaseline: (cfg as any).newProviderBaseline ?? 50,
    maxOpportunityBoost: (cfg as any).maxOpportunityBoost ?? 15,
  }
}

export function getWaveConfig(config: MatchingConfig, waveNumber: number): WaveConfig {
  switch (waveNumber) {
    case 1: return { waveNumber: 1, size: config.wave1Size, expiryMinutes: config.wave1ExpiryMinutes }
    case 2: return { waveNumber: 2, size: config.wave2Size, expiryMinutes: config.wave2ExpiryMinutes }
    case 3: return { waveNumber: 3, size: config.wave3Size, expiryMinutes: config.wave3ExpiryMinutes }
    default: return { waveNumber, size: config.wave3Size, expiryMinutes: config.wave3ExpiryMinutes }
  }
}

export { DEFAULT_WEIGHTS, DEFAULT_CONFIG }
