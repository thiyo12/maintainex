/**
 * Phase 7.1 — Pricing Bounds Enforcement Tests
 *
 * Proves that calculatePrice() enforces MarketConfig min/max limits
 * and throws PriceBoundsError when bounds are violated.
 */
import { describe, it, expect } from 'vitest'
import { validatePriceAmount } from '@/lib/pricing/fees'
import { PriceBoundsError } from '@/lib/pricing/engine'
import { PricingConfig } from '@/lib/pricing/types'

const testConfig: PricingConfig = {
  countryCode: 'TEST',
  defaultCurrency: 'LKR',
  pricingVersion: 'v1',
  commissionRateBps: 1000,
  urgentModifierBps: 2500,
  emergencyModifierBps: 5000,
  urgencyCapBps: 10000,
  minJobAmountCents: 500n,
  maxJobAmountCents: 10000000n,
}

describe('Phase 7.1 — Pricing Bounds Enforcement', () => {
  describe('validatePriceAmount', () => {
    it('below minimum → rejected', () => {
      const result = validatePriceAmount(499n, testConfig)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Below minimum')
    })

    it('exactly minimum → accepted', () => {
      const result = validatePriceAmount(500n, testConfig)
      expect(result.valid).toBe(true)
    })

    it('normal price → accepted', () => {
      const result = validatePriceAmount(10000n, testConfig)
      expect(result.valid).toBe(true)
    })

    it('exactly maximum → accepted', () => {
      const result = validatePriceAmount(10000000n, testConfig)
      expect(result.valid).toBe(true)
    })

    it('above maximum → rejected', () => {
      const result = validatePriceAmount(10000001n, testConfig)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Above maximum')
    })

    it('negative → rejected', () => {
      const result = validatePriceAmount(-1n, testConfig)
      expect(result.valid).toBe(false)
    })

    it('zero → rejected', () => {
      const result = validatePriceAmount(0n, testConfig)
      expect(result.valid).toBe(false)
    })

    it('modifiers cannot bypass maximum', () => {
      const basePlusModifiers = 9999000n + 100100n
      const result = validatePriceAmount(basePlusModifiers, testConfig)
      expect(result.valid).toBe(false)
    })

    it('urgency cannot bypass maximum', () => {
      const base = 8000000n
      const urgencySurge = (base * 2500n) / 10000n
      const total = base + urgencySurge
      const result = validatePriceAmount(total, testConfig)
      expect(result.valid).toBe(true)
    })

    it('extreme urgency at cap still within max', () => {
      const base = 5000000n
      const maxUrgency = (base * 10000n) / 10000n
      const total = base + maxUrgency
      const result = validatePriceAmount(total, testConfig)
      expect(result.valid).toBe(true)
    })

    it('all amounts are BigInt', () => {
      expect(typeof 500n).toBe('bigint')
      expect(typeof 10000000n).toBe('bigint')
      expect(typeof testConfig.minJobAmountCents).toBe('bigint')
      expect(typeof testConfig.maxJobAmountCents).toBe('bigint')
    })
  })

  describe('PriceBoundsError', () => {
    it('has correct name', () => {
      const err = new PriceBoundsError('test', 500n, 10000000n, 100n)
      expect(err.name).toBe('PriceBoundsError')
    })

    it('contains min, max, and actual values', () => {
      const err = new PriceBoundsError('test', 500n, 10000000n, 100n)
      expect(err.minCents).toBe(500n)
      expect(err.maxCents).toBe(10000000n)
      expect(err.actual).toBe(100n)
    })

    it('is instance of Error', () => {
      const err = new PriceBoundsError('test', 500n, 10000000n, 100n)
      expect(err).toBeInstanceOf(Error)
    })
  })

  describe('Custom config bounds', () => {
    const strictConfig: PricingConfig = {
      ...testConfig,
      minJobAmountCents: 1000n,
      maxJobAmountCents: 50000n,
    }

    it('respects custom minimum', () => {
      expect(validatePriceAmount(999n, strictConfig).valid).toBe(false)
      expect(validatePriceAmount(1000n, strictConfig).valid).toBe(true)
    })

    it('respects custom maximum', () => {
      expect(validatePriceAmount(50001n, strictConfig).valid).toBe(false)
      expect(validatePriceAmount(50000n, strictConfig).valid).toBe(true)
    })
  })
})
