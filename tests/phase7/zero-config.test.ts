/**
 * Phase 7.1 — Zero-Value MarketConfig Tests
 *
 * Proves that resolvePricingConfig() preserves intentional 0 values
 * and only falls back to defaults for null/undefined fields.
 */
import { describe, it, expect } from 'vitest'
import { resolvePricingConfig } from '@/lib/pricing/rules'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Phase 7.1 — Zero-Value MarketConfig Handling', () => {
  describe('resolvePricingConfig preserves zero values', () => {
    it('0 commission rate is preserved (not replaced with 1000)', async () => {
      const ts = Date.now()
      await (prisma as any).marketConfig.upsert({
        where: { countryCode: `ZCFG-${ts}` },
        create: {
          countryCode: `ZCFG-${ts}`,
          commissionRateBps: 0,
          urgentModifierBps: 2500,
          emergencyModifierBps: 5000,
          urgencyCapBps: 10000,
          minJobAmountCents: 500,
          maxJobAmountCents: 10000000,
        },
        update: {
          commissionRateBps: 0,
        },
      }).catch(() => {})

      const config = await resolvePricingConfig(prisma, `ZCFG-${ts}`)
      expect(config.commissionRateBps).toBe(0)

      await (prisma as any).marketConfig.delete({ where: { countryCode: `ZCFG-${ts}` } }).catch(() => {})
    })

    it('0 urgent modifier is preserved (not replaced with 2500)', async () => {
      const ts = Date.now()
      await (prisma as any).marketConfig.upsert({
        where: { countryCode: `ZCFG-U-${ts}` },
        create: {
          countryCode: `ZCFG-U-${ts}`,
          commissionRateBps: 1000,
          urgentModifierBps: 0,
          emergencyModifierBps: 5000,
          urgencyCapBps: 10000,
          minJobAmountCents: 500,
          maxJobAmountCents: 10000000,
        },
        update: { urgentModifierBps: 0 },
      }).catch(() => {})

      const config = await resolvePricingConfig(prisma, `ZCFG-U-${ts}`)
      expect(config.urgentModifierBps).toBe(0)

      await (prisma as any).marketConfig.delete({ where: { countryCode: `ZCFG-U-${ts}` } }).catch(() => {})
    })

    it('0 emergency modifier is preserved (not replaced with 5000)', async () => {
      const ts = Date.now()
      await (prisma as any).marketConfig.upsert({
        where: { countryCode: `ZCFG-E-${ts}` },
        create: {
          countryCode: `ZCFG-E-${ts}`,
          commissionRateBps: 1000,
          urgentModifierBps: 2500,
          emergencyModifierBps: 0,
          urgencyCapBps: 10000,
          minJobAmountCents: 500,
          maxJobAmountCents: 10000000,
        },
        update: { emergencyModifierBps: 0 },
      }).catch(() => {})

      const config = await resolvePricingConfig(prisma, `ZCFG-E-${ts}`)
      expect(config.emergencyModifierBps).toBe(0)

      await (prisma as any).marketConfig.delete({ where: { countryCode: `ZCFG-E-${ts}` } }).catch(() => {})
    })

    it('0 urgency cap is preserved (not replaced with 10000)', async () => {
      const ts = Date.now()
      await (prisma as any).marketConfig.upsert({
        where: { countryCode: `ZCFG-C-${ts}` },
        create: {
          countryCode: `ZCFG-C-${ts}`,
          commissionRateBps: 1000,
          urgentModifierBps: 2500,
          emergencyModifierBps: 5000,
          urgencyCapBps: 0,
          minJobAmountCents: 500,
          maxJobAmountCents: 10000000,
        },
        update: { urgencyCapBps: 0 },
      }).catch(() => {})

      const config = await resolvePricingConfig(prisma, `ZCFG-C-${ts}`)
      expect(config.urgencyCapBps).toBe(0)

      await (prisma as any).marketConfig.delete({ where: { countryCode: `ZCFG-C-${ts}` } }).catch(() => {})
    })

    it('missing/null values receive defaults', async () => {
      const config = await resolvePricingConfig(prisma, 'NONEXISTENT_COUNTRY')
      expect(config.commissionRateBps).toBe(1000)
      expect(config.urgentModifierBps).toBe(2500)
      expect(config.emergencyModifierBps).toBe(5000)
      expect(config.urgencyCapBps).toBe(10000)
      expect(config.minJobAmountCents).toBe(500n)
      expect(config.maxJobAmountCents).toBe(10000000n)
    })

    it('non-zero values are preserved correctly', async () => {
      const ts = Date.now()
      await (prisma as any).marketConfig.upsert({
        where: { countryCode: `ZCFG-NZ-${ts}` },
        create: {
          countryCode: `ZCFG-NZ-${ts}`,
          commissionRateBps: 500,
          urgentModifierBps: 1000,
          emergencyModifierBps: 3000,
          urgencyCapBps: 8000,
          minJobAmountCents: 1000,
          maxJobAmountCents: 5000000,
        },
        update: {
          commissionRateBps: 500,
          urgentModifierBps: 1000,
          emergencyModifierBps: 3000,
          urgencyCapBps: 8000,
          minJobAmountCents: 1000,
          maxJobAmountCents: 5000000,
        },
      }).catch(() => {})

      const config = await resolvePricingConfig(prisma, `ZCFG-NZ-${ts}`)
      expect(config.commissionRateBps).toBe(500)
      expect(config.urgentModifierBps).toBe(1000)
      expect(config.emergencyModifierBps).toBe(3000)
      expect(config.urgencyCapBps).toBe(8000)
      expect(config.minJobAmountCents).toBe(1000n)
      expect(config.maxJobAmountCents).toBe(5000000n)

      await (prisma as any).marketConfig.delete({ where: { countryCode: `ZCFG-NZ-${ts}` } }).catch(() => {})
    })
  })
})
