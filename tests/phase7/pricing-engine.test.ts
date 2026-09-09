/**
 * Phase 7 — Pricing Engine DB Tests
 *
 * Tests calculatePrice() and validateQuotePrice() from lib/pricing/engine.ts.
 * Requires VPS PostgreSQL with seeded MarketConfig, Category, and TemplateJob rows.
 *
 * Run on VPS only: DATABASE_URL must point to remote PostgreSQL.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { calculatePrice, validateQuotePrice } from '@/lib/pricing/engine'
import { PricingInput } from '@/lib/pricing/types'

const prisma = new PrismaClient()

describe('Phase 7 — Pricing Engine (DB)', () => {
  let testCategoryId: string
  let testTemplateId: string
  let testJobId: string

  beforeAll(async () => {
    try {
    const ts = Date.now()

    const category = await prisma.jobCategory.create({
      data: { name: `PE Test Category ${ts}`, slug: `pe-test-cat-${ts}`, isActive: true, sortOrder: 0, iconName: 'wrench', colorHex: '#000000', countries: '["LK"]' },
    })
    testCategoryId = category.id

    const template = await prisma.templateJob.create({
      data: {
        categoryId: testCategoryId,
        name: `PE Test Template ${ts}`,
        description: 'Test',
        whatIsIncluded: '[]',
        typicalDurationMinutes: 60,
        priceMin: 3000,
        priceMax: 7000,
        countries: '["LK"]',
        isActive: true,
      },
    })
    testTemplateId = template.id

    const job = await prisma.marketplaceJob.create({
      data: {
        customerId: 'pe-test-customer',
        title: `PE Test Job ${ts}`,
        description: 'Test',
        categoryId: testCategoryId,
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 20000n,
        status: 'OPEN',
      },
    })
    testJobId = job.id
    } catch { /* DB unavailable locally */ }
  })

  afterAll(async () => {
    await prisma.marketplaceJob.delete({ where: { id: testJobId } }).catch(() => {})
    await prisma.templateJob.delete({ where: { id: testTemplateId } }).catch(() => {})
    await prisma.jobCategory.delete({ where: { id: testCategoryId } }).catch(() => {})
  })

  // ── BOOK_NOW + NORMAL urgency ────────────────────────────────────

  it('BOOK_NOW with NORMAL urgency: base + 0 urgency + 0 modifiers + fee', async () => {
    const input: PricingInput = {
      jobId: testJobId,
      categoryId: testCategoryId,
      serviceTemplateId: testTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'NORMAL',
    }

    const result = await calculatePrice(prisma, input)

    // Base comes from template: avg of 3000+7000 = 5000 -> 500000 cents
    expect(result.baseAmount).toBe(500000n)
    expect(result.urgencyAmount).toBe(0n)
    expect(result.serviceModifiers).toBe(0n)
    expect(result.providerGross).toBe(500000n)

    // Platform fee: 10% (1000 bps) of providerGross
    const expectedFee = (500000n * 1000n) / 10000n
    expect(result.platformFeeAmount).toBe(expectedFee)
    expect(result.customerTotal).toBe(result.providerGross + result.platformFeeAmount)
    expect(result.currency).toBe('LKR')
  })

  // ── BOOK_NOW + URGENT ────────────────────────────────────────────

  it('BOOK_NOW with URGENT: base + 25% urgency + fee', async () => {
    const input: PricingInput = {
      jobId: testJobId,
      categoryId: testCategoryId,
      serviceTemplateId: testTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'URGENT',
    }

    const result = await calculatePrice(prisma, input)

    // base = 500000, urgency = 500000 * 2500 / 10000 = 125000
    expect(result.baseAmount).toBe(500000n)
    expect(result.urgencyAmount).toBe(125000n)
    expect(result.providerGross).toBe(625000n)
    expect(result.ruleIds).toContain('urgency_urgent')
  })

  // ── BOOK_NOW + EMERGENCY ─────────────────────────────────────────

  it('BOOK_NOW with EMERGENCY: base + 50% urgency (capped at 100%) + fee', async () => {
    const input: PricingInput = {
      jobId: testJobId,
      categoryId: testCategoryId,
      serviceTemplateId: testTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'EMERGENCY',
    }

    const result = await calculatePrice(prisma, input)

    // base = 500000, urgency = 500000 * 5000 / 10000 = 250000 (not capped, < 100%)
    expect(result.urgencyAmount).toBe(250000n)
    expect(result.providerGross).toBe(750000n)
    expect(result.ruleIds).toContain('urgency_emergency')
  })

  // ── QUOTE mode ───────────────────────────────────────────────────

  it('QUOTE mode uses same formula with different base resolution', async () => {
    const input: PricingInput = {
      jobId: testJobId,
      categoryId: testCategoryId,
      mode: 'QUOTE',
      urgency: 'NORMAL',
    }

    const result = await calculatePrice(prisma, input)
    // No templateId → base falls back to category avg or default 500000
    expect(result.baseAmount).toBeGreaterThanOrEqual(500000n)
    expect(result.currency).toBe('LKR')
  })

  // ── Multi-quantity pricing ───────────────────────────────────────

  it('Multi-quantity pricing: quantity=3 adds modifiers', async () => {
    const input: PricingInput = {
      jobId: testJobId,
      categoryId: testCategoryId,
      serviceTemplateId: testTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'NORMAL',
      quantity: 3,
    }

    const result = await calculatePrice(prisma, input)

    // (3-1) * 2000 = 4000 modifier
    expect(result.serviceModifiers).toBe(4000n)
    expect(result.ruleIds).toContain('service_modifiers')
  })

  // ── Long duration pricing ────────────────────────────────────────

  it('Long duration pricing: >60min adds time modifiers', async () => {
    const input: PricingInput = {
      jobId: testJobId,
      categoryId: testCategoryId,
      serviceTemplateId: testTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'NORMAL',
      durationMinutes: 120,
    }

    const result = await calculatePrice(prisma, input)

    // (120-60)/30 = 2 extra blocks * 1500 = 3000
    expect(result.serviceModifiers).toBe(3000n)
  })

  // ── All amounts are BigInt ───────────────────────────────────────

  it('All amounts are BigInt (no Float)', async () => {
    const input: PricingInput = {
      jobId: testJobId,
      categoryId: testCategoryId,
      serviceTemplateId: testTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'URGENT',
      quantity: 2,
      durationMinutes: 90,
    }

    const result = await calculatePrice(prisma, input)

    expect(typeof result.baseAmount).toBe('bigint')
    expect(typeof result.urgencyAmount).toBe('bigint')
    expect(typeof result.serviceModifiers).toBe('bigint')
    expect(typeof result.providerGross).toBe('bigint')
    expect(typeof result.platformFeeAmount).toBe('bigint')
    expect(typeof result.customerTotal).toBe('bigint')
  })

  // ── Invariants ───────────────────────────────────────────────────

  it('customerTotal = providerGross + platformFeeAmount', async () => {
    const input: PricingInput = {
      jobId: testJobId,
      categoryId: testCategoryId,
      serviceTemplateId: testTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'EMERGENCY',
      quantity: 2,
      durationMinutes: 90,
    }

    const result = await calculatePrice(prisma, input)
    expect(result.customerTotal).toBe(result.providerGross + result.platformFeeAmount)
  })

  it('providerGross = baseAmount + urgencyAmount + serviceModifiers', async () => {
    const input: PricingInput = {
      jobId: testJobId,
      categoryId: testCategoryId,
      serviceTemplateId: testTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'URGENT',
      quantity: 3,
      durationMinutes: 150,
    }

    const result = await calculatePrice(prisma, input)
    expect(result.providerGross).toBe(result.baseAmount + result.urgencyAmount + result.serviceModifiers)
  })

  // ── Currency always LKR ──────────────────────────────────────────

  it('Currency always LKR', async () => {
    const input: PricingInput = {
      jobId: testJobId,
      categoryId: testCategoryId,
      mode: 'BOOK_NOW',
      urgency: 'NORMAL',
    }

    const result = await calculatePrice(prisma, input)
    expect(result.currency).toBe('LKR')
  })

  // ── validateQuotePrice ───────────────────────────────────────────

  describe('validateQuotePrice', () => {
    it('positive price accepted', () => {
      const result = validateQuotePrice(5000n, 10000n)
      expect(result.valid).toBe(true)
    })

    it('negative price rejected', () => {
      const result = validateQuotePrice(-100n, 10000n)
      expect(result.valid).toBe(false)
    })

    it('zero price rejected', () => {
      const result = validateQuotePrice(0n, 10000n)
      expect(result.valid).toBe(false)
    })

    it('price >3x budget rejected', () => {
      // budget 10000, price 30001 > 30000
      const result = validateQuotePrice(30_001n, 10_000n)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('3x')
    })

    it('price exactly 3x budget accepted', () => {
      const result = validateQuotePrice(30_000n, 10_000n)
      expect(result.valid).toBe(true)
    })

    it('zero budget disables 3x check', () => {
      const result = validateQuotePrice(100_000n, 0n)
      expect(result.valid).toBe(true)
    })
  })
})
