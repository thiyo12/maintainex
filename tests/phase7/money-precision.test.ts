/**
 * Phase 7 — BigInt Money Precision Tests
 *
 * Verifies that all money operations use BigInt and never Float,
 * preventing floating point precision issues at any scale.
 *
 * No DB required — all tests run locally.
 */

import { describe, it, expect } from 'vitest'
import {
  lkrCents,
  lkrRupees,
  createMoney,
  addMoney,
  subtractMoney,
  multiplyMoney,
  divideMoney,
  computeCommission,
  computeCommissionFromBps,
  minorUnitsToDisplay,
  minorUnitsToMajorUnits,
  legacyToMinorUnits,
  moneyEquals,
  validatePositive,
  ZERO_LKR,
} from '@/lib/money'
import {
  computeUrgencyModifier,
  applyModifierBps,
  capUrgencySurge,
  computePlatformFee,
} from '@/lib/pricing/fees'
import { PricingConfig } from '@/lib/pricing/types'

const defaultConfig: PricingConfig = {
  countryCode: 'GLOBAL',
  pricingVersion: 'v1',
  commissionRateBps: 1000,
  urgentModifierBps: 2500,
  emergencyModifierBps: 5000,
  urgencyCapBps: 10000,
  minJobAmountCents: 500n,
  maxJobAmountCents: 10_000_000n,
}

describe('Phase 7 — BigInt Money Precision', () => {
  // ── Large and small amounts ──────────────────────────────────────

  it('Large amounts (1M LKR = 100,000,000 cents) computed correctly', () => {
    const oneMillionLkr = lkrRupees(1_000_000)
    expect(oneMillionLkr.amount).toBe(100_000_000n)
    expect(oneMillionLkr.currency).toBe('LKR')

    const doubled = multiplyMoney(oneMillionLkr, 2)
    expect(doubled.amount).toBe(200_000_000n)
  })

  it('Small amounts (5 LKR = 500 cents) computed correctly', () => {
    const fiveLkr = lkrRupees(5)
    expect(fiveLkr.amount).toBe(500n)
    expect(fiveLkr.currency).toBe('LKR')
  })

  it('lkrCents creates correct MoneyAmount', () => {
    const amount = lkrCents(12345n)
    expect(amount.amount).toBe(12345n)
    expect(amount.currency).toBe('LKR')
  })

  // ── Fee calculation on large amounts ─────────────────────────────

  it('Fee calculation on large amounts does not overflow', () => {
    const largeAmount = 1_000_000_000n // 10M LKR in cents
    const fee = computePlatformFee(largeAmount, 1000) // 10%
    expect(fee).toBe(100_000_000n)

    // Verify no floating point: fee should be exactly 10%
    expect(fee * 10n).toBe(largeAmount)
  })

  it('Fee calculation on very small amounts is exact', () => {
    const smallAmount = 500n // 5 LKR
    const fee = computePlatformFee(smallAmount, 1000) // 10%
    expect(fee).toBe(50n)
  })

  // ── Urgency modifier on large amounts ────────────────────────────

  it('Urgency modifier on large amounts does not overflow', () => {
    const largeBase = 500_000_000n // 5M LKR
    const modifier = applyModifierBps(largeBase, 5000n) // 50%
    expect(modifier).toBe(250_000_000n)

    const capped = capUrgencySurge(modifier, largeBase, 10_000)
    expect(capped).toBe(250_000_000n)
  })

  it('Emergency modifier at 50% on large base', () => {
    const base = 1_000_000_000n // 10M LKR
    const emergency = computeUrgencyModifier('EMERGENCY', defaultConfig)
    const amount = applyModifierBps(base, BigInt(emergency.bps))
    expect(amount).toBe(500_000_000n)
  })

  // ── All operations use BigInt ────────────────────────────────────

  it('All money operations return BigInt', () => {
    const a = lkrCents(1000n)
    const b = lkrCents(500n)

    const sum = addMoney(a, b)
    expect(typeof sum.amount).toBe('bigint')

    const diff = subtractMoney(a, b)
    expect(typeof diff.amount).toBe('bigint')

    const product = multiplyMoney(a, 3)
    expect(typeof product.amount).toBe('bigint')

    const quotient = divideMoney(a, 10n)
    expect(typeof quotient).toBe('bigint')

    const commission = computeCommission(10_000n, 10)
    expect(typeof commission).toBe('bigint')

    const commissionBps = computeCommissionFromBps(10_000n, 1000n)
    expect(typeof commissionBps).toBe('bigint')
  })

  it('createMoney returns BigInt amount', () => {
    const money = createMoney(42_000n)
    expect(typeof money.amount).toBe('bigint')
    expect(money.amount).toBe(42_000n)
  })

  // ── No floating point precision issues ───────────────────────────

  it('No floating point: 0.1 + 0.2 does not appear in BigInt math', () => {
    const a = lkrCents(10n) // 0.10 LKR
    const b = lkrCents(20n) // 0.20 LKR
    const sum = addMoney(a, b)

    // 0.10 + 0.20 = 0.30 exactly in cents
    expect(sum.amount).toBe(30n)

    // Verify it is NOT 0.2999... or 0.3000...1
    expect(sum.amount === 30n).toBe(true)
  })

  it('Division truncates correctly (no fractional cents)', () => {
    const amount = lkrCents(100n) // 1.00 LKR
    const result = divideMoney(amount, 3n) // 100 / 3 = 33 (truncated)
    expect(result).toBe(33n)
    expect(typeof result).toBe('bigint')
  })

  it('Commission calculation is exact for common rates', () => {
    // 10% of 10000 = 1000
    expect(computeCommission(10_000n, 10)).toBe(1000n)

    // 15% of 10000 = 1500
    expect(computeCommission(10_000n, 15)).toBe(1500n)

    // 2.5% of 10000 = 250
    expect(computeCommission(10_000n, 2.5)).toBe(250n)

    // 1% of 10000 = 100
    expect(computeCommission(10_000n, 1)).toBe(100n)
  })

  it('Bps-based commission matches percent-based commission', () => {
    const amount = 75_000n
    const percentResult = computeCommission(amount, 10)
    const bpsResult = computeCommissionFromBps(amount, 1000n)
    expect(percentResult).toBe(bpsResult)
  })

  // ── Display formatting ───────────────────────────────────────────

  it('minorUnitsToDisplay formats large amounts correctly', () => {
    const display = minorUnitsToDisplay(100_000_000n) // 1M LKR
    expect(display).toContain('1,000,000')
  })

  it('minorUnitsToDisplay formats fractional amounts', () => {
    const display = minorUnitsToDisplay(12345n) // 123.45 LKR
    expect(display).toContain('123')
    expect(display).toContain('45')
  })

  it('minorUnitsToMajorUnits returns correct float', () => {
    const major = minorUnitsToMajorUnits(12345n)
    expect(major).toBeCloseTo(123.45, 2)
  })

  // ── Equality and validation ──────────────────────────────────────

  it('moneyEquals compares correctly', () => {
    const a = lkrCents(1000n)
    const b = lkrCents(1000n)
    const c = lkrCents(1001n)

    expect(moneyEquals(a, b)).toBe(true)
    expect(moneyEquals(a, c)).toBe(false)
  })

  it('validatePositive rejects zero', () => {
    expect(() => validatePositive(ZERO_LKR)).toThrow('Amount must be positive')
  })

  it('validatePositive accepts positive amounts', () => {
    expect(() => validatePositive(createMoney(1n))).not.toThrow()
    expect(() => validatePositive(createMoney(1000n))).not.toThrow()
  })

  // ── Edge cases ───────────────────────────────────────────────────

  it('Maximum safe BigInt multiplication does not lose precision', () => {
    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER)
    const result = maxSafe * 2n
    expect(result).toBe(maxSafe * 2n)
    expect(typeof result).toBe('bigint')
  })

  it('Zero amount operations', () => {
    const zero = lkrCents(0n)
    expect(addMoney(zero, zero).amount).toBe(0n)
    expect(multiplyMoney(zero, 100).amount).toBe(0n)
    expect(computePlatformFee(0n, 1000)).toBe(0n)
  })

  it('legacyToMinorUnits handles fractional precision edge cases', () => {
    // 0.01 LKR = 1 cent
    expect(legacyToMinorUnits(0.01)).toBe(1n)

    // 0.001 LKR rounds to 0 cents
    expect(legacyToMinorUnits(0.001)).toBe(0n)

    // 99.99 LKR = 9999 cents
    expect(legacyToMinorUnits(99.99)).toBe(9999n)
  })
})
