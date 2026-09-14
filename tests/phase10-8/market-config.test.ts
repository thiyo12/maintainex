import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { updateMarketConfig, validatePricingMode } from '../../lib/domain/market-config'
import type { AdminSession } from '../../lib/admin-types'

const prisma = new PrismaClient()

const ADMIN_SESSION: AdminSession = {
  id: 'admin-market-108',
  email: 'admin-market-108@test.com',
  role: 'SUPER_ADMIN',
  firstName: 'Admin',
  lastName: 'Market108',
  assignedCountries: ['LK'],
  authType: 'adminUser',
}

let testCountryCode = 'LK'

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { adminUserId: 'admin-market-108' } })
})

beforeAll(async () => {
  await prisma.marketConfig.upsert({
    where: { countryCode: testCountryCode },
    update: {},
    create: {
      countryCode: testCountryCode,
      weightCapability: 25, weightReliability: 25,
      weightReputation: 25, weightAvailability: 25,
      weightTravel: 0, weightExperience: 0,
      weightFairness: 0, weightPreferredSkill: 0,
      wave1Size: 5, wave2Size: 10, wave3Size: 20,
      wave1ExpiryMinutes: 30, wave2ExpiryMinutes: 60, wave3ExpiryMinutes: 120,
      commissionRateBps: 500,
      minJobAmountCents: 100, maxJobAmountCents: 100000000,
      urgentModifierBps: 1000, emergencyModifierBps: 2000, urgencyCapBps: 5000,
    },
  })
})

describe('Phase 10.8 — Market Config Validation', () => {
  it('validatePricingMode accepts valid modes', async () => {
    expect(await validatePricingMode('INSTANT_PRICE')).toBe(true)
    expect(await validatePricingMode('SMART_QUOTE')).toBe(true)
    expect(await validatePricingMode('INSPECTION_FIRST')).toBe(true)
  })

  it('validatePricingMode rejects invalid mode', async () => {
    expect(await validatePricingMode('INVALID')).toBe(false)
  })
})

describe('Phase 10.8 — Market Config Update', () => {
  it('updateMarketConfig updates weights and creates audit', async () => {
    const result = await updateMarketConfig(prisma, {
      countryCode: testCountryCode,
      changes: { weightCapability: 30, weightReliability: 20 },
      reason: 'Recalibrate capability weight',
      session: ADMIN_SESSION,
      ipAddress: '127.0.0.1',
    })

    expect(result.success).toBe(true)
    expect(result.config.weightCapability).toBe(30)
    expect(result.config.weightReliability).toBe(20)

    const audit = await prisma.auditLog.findFirst({
      where: { adminUserId: 'admin-market-108', action: 'MARKET_CONFIG_UPDATE' },
    })
    expect(audit).not.toBeNull()
  })

  it('updateMarketConfig validates wave sizes out of range', async () => {
    await expect(
      updateMarketConfig(prisma, {
        countryCode: testCountryCode,
        changes: { wave1Size: 100 },
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('Validation failed')
  })

  it('updateMarketConfig validates commission rate', async () => {
    await expect(
      updateMarketConfig(prisma, {
        countryCode: testCountryCode,
        changes: { commissionRateBps: -100 },
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('Validation failed')
  })

  it('updateMarketConfig rejects non-existent country', async () => {
    await expect(
      updateMarketConfig(prisma, {
        countryCode: 'ZZ',
        changes: { weightCapability: 10 },
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('not found')
  })

  it('updateMarketConfig rejects empty changes', async () => {
    await expect(
      updateMarketConfig(prisma, {
        countryCode: testCountryCode,
        changes: {},
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('No valid fields')
  })

  it('updateMarketConfig rejects percentile low >= high', async () => {
    await expect(
      updateMarketConfig(prisma, {
        countryCode: testCountryCode,
        changes: { benchmarkPercentileLow: 80, benchmarkPercentileHigh: 20 },
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('Validation failed')
  })

  it('updateMarketConfig accepts valid percentile range', async () => {
    const result = await updateMarketConfig(prisma, {
      countryCode: testCountryCode,
      changes: { benchmarkPercentileLow: 10, benchmarkPercentileHigh: 90 },
      session: ADMIN_SESSION,
      ipAddress: '127.0.0.1',
    })

    expect(result.success).toBe(true)
    expect(result.config.benchmarkPercentileLow).toBe(10)
    expect(result.config.benchmarkPercentileHigh).toBe(90)
  })
})
