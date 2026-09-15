import { PrismaClient } from '@prisma/client'
import type { AdminSession, AuditAction } from '../admin-types'

export interface UpdateMarketConfigInput {
  countryCode: string
  expectedVersion?: number
  changes: Record<string, unknown>
  reason?: string
  session: AdminSession
  ipAddress: string
}

const VALID_WAVE_SIZES = { min: 1, max: 50 }
const VALID_EXPIRY_MINUTES = { min: 1, max: 1440 }
const VALID_WEIGHT_RANGE = { min: 0, max: 100 }
const VALID_BPS_RANGE = { min: 0, max: 50000 }
const VALID_PERCENTILE_RANGE = { min: 1, max: 99 }
const VALID_IQR_MULT = { min: 0.5, max: 5.0 }
const VALID_BENCHMARK_SAMPLE = { min: 1, max: 1000 }

function validateMarketConfigChanges(changes: Record<string, unknown>): string[] {
  const errors: string[] = []

  if (changes.wave1Size !== undefined) {
    const v = changes.wave1Size as number
    if (!Number.isInteger(v) || v < VALID_WAVE_SIZES.min || v > VALID_WAVE_SIZES.max) {
      errors.push(`wave1Size must be integer ${VALID_WAVE_SIZES.min}-${VALID_WAVE_SIZES.max}`)
    }
  }
  if (changes.wave2Size !== undefined) {
    const v = changes.wave2Size as number
    if (!Number.isInteger(v) || v < VALID_WAVE_SIZES.min || v > VALID_WAVE_SIZES.max) {
      errors.push(`wave2Size must be integer ${VALID_WAVE_SIZES.min}-${VALID_WAVE_SIZES.max}`)
    }
  }
  if (changes.wave3Size !== undefined) {
    const v = changes.wave3Size as number
    if (!Number.isInteger(v) || v < VALID_WAVE_SIZES.min || v > VALID_WAVE_SIZES.max) {
      errors.push(`wave3Size must be integer ${VALID_WAVE_SIZES.min}-${VALID_WAVE_SIZES.max}`)
    }
  }
  if (changes.wave1ExpiryMinutes !== undefined) {
    const v = changes.wave1ExpiryMinutes as number
    if (!Number.isInteger(v) || v < VALID_EXPIRY_MINUTES.min || v > VALID_EXPIRY_MINUTES.max) {
      errors.push(`wave1ExpiryMinutes must be integer ${VALID_EXPIRY_MINUTES.min}-${VALID_EXPIRY_MINUTES.max}`)
    }
  }
  if (changes.wave2ExpiryMinutes !== undefined) {
    const v = changes.wave2ExpiryMinutes as number
    if (!Number.isInteger(v) || v < VALID_EXPIRY_MINUTES.min || v > VALID_EXPIRY_MINUTES.max) {
      errors.push(`wave2ExpiryMinutes must be integer ${VALID_EXPIRY_MINUTES.min}-${VALID_EXPIRY_MINUTES.max}`)
    }
  }
  if (changes.wave3ExpiryMinutes !== undefined) {
    const v = changes.wave3ExpiryMinutes as number
    if (!Number.isInteger(v) || v < VALID_EXPIRY_MINUTES.min || v > VALID_EXPIRY_MINUTES.max) {
      errors.push(`wave3ExpiryMinutes must be integer ${VALID_EXPIRY_MINUTES.min}-${VALID_EXPIRY_MINUTES.max}`)
    }
  }

  const weightFields = ['weightCapability', 'weightReliability', 'weightReputation', 'weightAvailability', 'weightTravel', 'weightExperience', 'weightFairness', 'weightPreferredSkill']
  for (const field of weightFields) {
    if (changes[field] !== undefined) {
      const v = changes[field] as number
      if (typeof v !== 'number' || v < VALID_WEIGHT_RANGE.min || v > VALID_WEIGHT_RANGE.max) {
        errors.push(`${field} must be number ${VALID_WEIGHT_RANGE.min}-${VALID_WEIGHT_RANGE.max}`)
      }
    }
  }

  if (changes.commissionRateBps !== undefined) {
    const v = changes.commissionRateBps as number
    if (!Number.isInteger(v) || v < VALID_BPS_RANGE.min || v > VALID_BPS_RANGE.max) {
      errors.push(`commissionRateBps must be integer ${VALID_BPS_RANGE.min}-${VALID_BPS_RANGE.max}`)
    }
  }
  if (changes.urgentModifierBps !== undefined) {
    const v = changes.urgentModifierBps as number
    if (!Number.isInteger(v) || v < VALID_BPS_RANGE.min || v > VALID_BPS_RANGE.max) {
      errors.push(`urgentModifierBps must be integer ${VALID_BPS_RANGE.min}-${VALID_BPS_RANGE.max}`)
    }
  }
  if (changes.emergencyModifierBps !== undefined) {
    const v = changes.emergencyModifierBps as number
    if (!Number.isInteger(v) || v < VALID_BPS_RANGE.min || v > VALID_BPS_RANGE.max) {
      errors.push(`emergencyModifierBps must be integer ${VALID_BPS_RANGE.min}-${VALID_BPS_RANGE.max}`)
    }
  }
  if (changes.urgencyCapBps !== undefined) {
    const v = changes.urgencyCapBps as number
    if (!Number.isInteger(v) || v < VALID_BPS_RANGE.min || v > VALID_BPS_RANGE.max) {
      errors.push(`urgencyCapBps must be integer ${VALID_BPS_RANGE.min}-${VALID_BPS_RANGE.max}`)
    }
  }

  if (changes.minBenchmarkSample !== undefined) {
    const v = changes.minBenchmarkSample as number
    if (!Number.isInteger(v) || v < VALID_BENCHMARK_SAMPLE.min || v > VALID_BENCHMARK_SAMPLE.max) {
      errors.push(`minBenchmarkSample must be integer ${VALID_BENCHMARK_SAMPLE.min}-${VALID_BENCHMARK_SAMPLE.max}`)
    }
  }
  if (changes.benchmarkPercentileLow !== undefined) {
    const v = changes.benchmarkPercentileLow as number
    const high = typeof changes.benchmarkPercentileHigh === 'number' ? changes.benchmarkPercentileHigh : 75
    if (!Number.isInteger(v) || v < VALID_PERCENTILE_RANGE.min || v >= high) {
      errors.push(`benchmarkPercentileLow must be < benchmarkPercentileHigh`)
    }
  }
  if (changes.benchmarkPercentileHigh !== undefined) {
    const v = changes.benchmarkPercentileHigh as number
    const low = typeof changes.benchmarkPercentileLow === 'number' ? changes.benchmarkPercentileLow : 25
    if (!Number.isInteger(v) || v <= low || v > VALID_PERCENTILE_RANGE.max) {
      errors.push(`benchmarkPercentileHigh must be > benchmarkPercentileLow`)
    }
  }
  if (changes.benchmarkOutlierIqrMult !== undefined) {
    const v = changes.benchmarkOutlierIqrMult as number
    if (typeof v !== 'number' || v < VALID_IQR_MULT.min || v > VALID_IQR_MULT.max) {
      errors.push(`benchmarkOutlierIqrMult must be number ${VALID_IQR_MULT.min}-${VALID_IQR_MULT.max}`)
    }
  }

  if (changes.newProviderBaseline !== undefined) {
    const v = changes.newProviderBaseline as number
    if (typeof v !== 'number' || v < 0 || v > 100) {
      errors.push('newProviderBaseline must be 0-100')
    }
  }
  if (changes.maxOpportunityBoost !== undefined) {
    const v = changes.maxOpportunityBoost as number
    if (typeof v !== 'number' || v < 0 || v > 50) {
      errors.push('maxOpportunityBoost must be 0-50')
    }
  }

  return errors
}

export async function updateMarketConfig(
  tx: PrismaClient,
  input: UpdateMarketConfigInput
) {
  const { countryCode, expectedVersion, changes, reason, session, ipAddress } = input

  const errors = validateMarketConfigChanges(changes)
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join('; ')}`)
  }

  const existing = await tx.marketConfig.findUnique({
    where: { countryCode },
  })

  if (!existing) {
    throw new Error(`MarketConfig not found for country: ${countryCode}`)
  }

  const oldValue = { ...existing }

  function safeStringify(obj: unknown): string {
    return JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  }

  const updateData: Record<string, unknown> = {}
  const allowedFields = [
    'weightCapability', 'weightReliability', 'weightReputation',
    'weightAvailability', 'weightTravel', 'weightExperience',
    'weightFairness', 'weightPreferredSkill',
    'wave1Size', 'wave2Size', 'wave3Size',
    'wave1ExpiryMinutes', 'wave2ExpiryMinutes', 'wave3ExpiryMinutes',
    'newProviderBaseline', 'maxOpportunityBoost',
    'urgentModifierBps', 'emergencyModifierBps', 'urgencyCapBps',
    'commissionRateBps', 'minJobAmountCents', 'maxJobAmountCents',
    'minBenchmarkSample', 'benchmarkPercentileLow', 'benchmarkPercentileHigh',
    'benchmarkOutlierIqrMult', 'benchmarkFallbackEnabled', 'benchmarkResearchIntervalMonths',
  ]

  for (const field of allowedFields) {
    if (changes[field] !== undefined) {
      (updateData as any)[field] = changes[field]
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('No valid fields to update')
  }

  const updated = await tx.marketConfig.updateMany({
    where: { countryCode, updatedAt: existing.updatedAt },
    data: updateData,
  })

  if (updated.count === 0) {
    throw new Error('Concurrent modification detected — another admin updated this config. Please refresh and retry.')
  }

  const freshConfig = await tx.marketConfig.findUnique({ where: { countryCode } })

  await tx.auditLog.create({
    data: {
      adminUserId: session.id,
      adminEmail: session.email,
      adminRole: session.role,
      action: 'MARKET_CONFIG_UPDATE' as AuditAction,
      targetTable: 'MarketConfig',
      targetId: freshConfig!.id,
      targetLabel: `MarketConfig (${countryCode})`,
      oldValue: safeStringify(oldValue),
      newValue: safeStringify({ ...updateData, reason }),
      ipAddress,
    },
  })

  return { success: true, config: freshConfig!, countryCode }
}

export async function validatePricingMode(mode: string): Promise<boolean> {
  const validModes = ['INSTANT_PRICE', 'SMART_QUOTE', 'INSPECTION_FIRST']
  return validModes.includes(mode)
}
