/**
 * Phase 7 — Fee Calculation Unit Tests
 *
 * Tests pure functions from lib/pricing/fees.ts:
 * - computeUrgencyModifier
 * - applyModifierBps
 * - capUrgencySurge
 * - computePlatformFee
 * - validatePriceAmount
 *
 * No DB required — all tests run locally.
 */

import { describe, it, expect } from 'vitest'
import {
  computeUrgencyModifier,
  applyModifierBps,
  capUrgencySurge,
  computePlatformFee,
  validatePriceAmount,
} from '@/lib/pricing/fees'
import { PricingConfig } from '@/lib/pricing/types'

const defaultConfig: PricingConfig = {
  countryCode: 'GLOBAL',
  defaultCurrency: 'LKR',
  pricingVersion: 'v1',
  commissionRateBps: 1000,
  urgentModifierBps: 2500,
  emergencyModifierBps: 5000,
  urgencyCapBps: 10000,
  minJobAmountCents: 500n,
  maxJobAmountCents: 10_000_000n,
}

describe('Phase 7 — Fee Calculations', () => {
  // ── computeUrgencyModifier ────────────────────────────────────────

  describe('computeUrgencyModifier', () => {
    it('NORMAL urgency returns 0 bps', () => {
      const result = computeUrgencyModifier('NORMAL', defaultConfig)
      expect(result.bps).toBe(0)
      expect(result.ruleId).toBe('urgency_normal')
      expect(result.amount).toBe(0n)
    })

    it('URGENT urgency returns 2500 bps', () => {
      const result = computeUrgencyModifier('URGENT', defaultConfig)
      expect(result.bps).toBe(2500)
      expect(result.ruleId).toBe('urgency_urgent')
    })

    it('EMERGENCY urgency returns 5000 bps', () => {
      const result = computeUrgencyModifier('EMERGENCY', defaultConfig)
      expect(result.bps).toBe(5000)
      expect(result.ruleId).toBe('urgency_emergency')
    })

    it('lowercase urgency is handled case-insensitively', () => {
      const urgent = computeUrgencyModifier('urgent', defaultConfig)
      expect(urgent.bps).toBe(2500)

      const emergency = computeUrgencyModifier('emergency', defaultConfig)
      expect(emergency.bps).toBe(5000)

      const normal = computeUrgencyModifier('normal', defaultConfig)
      expect(normal.bps).toBe(0)
    })

    it('unknown urgency defaults to 0 bps', () => {
      const result = computeUrgencyModifier('WHATEVER', defaultConfig)
      expect(result.bps).toBe(0)
      expect(result.ruleId).toBe('urgency_normal')
    })
  })

  // ── applyModifierBps ─────────────────────────────────────────────

  describe('applyModifierBps', () => {
    it('10000 base * 2500 bps = 2500', () => {
      expect(applyModifierBps(10_000n, 2500n)).toBe(2500n)
    })

    it('10000 base * 5000 bps = 5000', () => {
      expect(applyModifierBps(10_000n, 5000n)).toBe(5000n)
    })

    it('10000 base * 0 bps = 0', () => {
      expect(applyModifierBps(10_000n, 0n)).toBe(0n)
    })

    it('10000 base * 10000 bps = 10000 (100%)', () => {
      expect(applyModifierBps(10_000n, 10_000n)).toBe(10_000n)
    })

    it('handles large base amounts without overflow', () => {
      const large = 1_000_000_000n // 10M LKR in cents
      const result = applyModifierBps(large, 2500n)
      expect(result).toBe(250_000_000n)
    })

    it('handles zero base amount', () => {
      expect(applyModifierBps(0n, 2500n)).toBe(0n)
    })

    it('handles fractional bps via BigInt division', () => {
      // 5000 * 1500 / 10000 = 750
      expect(applyModifierBps(5000n, 1500n)).toBe(750n)
    })
  })

  // ── capUrgencySurge ──────────────────────────────────────────────

  describe('capUrgencySurge', () => {
    it('surge within cap returns the surge amount', () => {
      // base 10000, cap 10000 bps (100%), surge 2500 < 10000
      const result = capUrgencySurge(2500n, 10_000n, 10_000)
      expect(result).toBe(2500n)
    })

    it('surge exceeds cap returns the cap', () => {
      // base 10000, cap 5000 bps (50%), surge 8000 > 5000
      const result = capUrgencySurge(8000n, 10_000n, 5000)
      expect(result).toBe(5000n)
    })

    it('surge equals cap returns the surge (not capped)', () => {
      // base 10000, cap 2500 bps (25%), surge = 2500
      const result = capUrgencySurge(2500n, 10_000n, 2500)
      expect(result).toBe(2500n)
    })

    it('zero surge returns zero', () => {
      const result = capUrgencySurge(0n, 10_000n, 10_000)
      expect(result).toBe(0n)
    })

    it('cap 10000 bps (100%) with large base', () => {
      const base = 1_000_000n
      const surge = 1_500_000n // exceeds 100%
      const result = capUrgencySurge(surge, base, 10_000)
      expect(result).toBe(base) // capped at 100%
    })
  })

  // ── computePlatformFee ───────────────────────────────────────────

  describe('computePlatformFee', () => {
    it('10000 * 1000 bps = 1000 (10%)', () => {
      expect(computePlatformFee(10_000n, 1000)).toBe(1000n)
    })

    it('5000 * 1000 bps = 500', () => {
      expect(computePlatformFee(5000n, 1000)).toBe(500n)
    })

    it('0 amount returns 0', () => {
      expect(computePlatformFee(0n, 1000)).toBe(0n)
    })

    it('0 bps returns 0', () => {
      expect(computePlatformFee(10_000n, 0)).toBe(0n)
    })

    it('large amount * bps without overflow', () => {
      const large = 100_000_000n // 1M LKR
      const fee = computePlatformFee(large, 1000)
      expect(fee).toBe(10_000_000n)
    })

    it('1500 bps (15%) on 10000 = 1500', () => {
      expect(computePlatformFee(10_000n, 1500)).toBe(1500n)
    })
  })

  // ── validatePriceAmount ──────────────────────────────────────────

  describe('validatePriceAmount', () => {
    it('negative amount is rejected', () => {
      const result = validatePriceAmount(-100n, defaultConfig)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Negative price rejected')
    })

    it('zero amount is rejected', () => {
      const result = validatePriceAmount(0n, defaultConfig)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Zero price rejected')
    })

    it('below minimum is rejected', () => {
      // minJobAmountCents = 500
      const result = validatePriceAmount(499n, defaultConfig)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Below minimum')
    })

    it('above maximum is rejected', () => {
      // maxJobAmountCents = 10_000_000
      const result = validatePriceAmount(10_000_001n, defaultConfig)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Above maximum')
    })

    it('valid amount within range is accepted', () => {
      const result = validatePriceAmount(5000n, defaultConfig)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('amount at exact minimum is accepted', () => {
      const result = validatePriceAmount(500n, defaultConfig)
      expect(result.valid).toBe(true)
    })

    it('amount at exact maximum is accepted', () => {
      const result = validatePriceAmount(10_000_000n, defaultConfig)
      expect(result.valid).toBe(true)
    })
  })
})
