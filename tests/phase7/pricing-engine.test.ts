/**
 * Phase 7 — Pricing Engine DB Tests
 *
 * Tests calculatePrice() and validateQuotePrice() from lib/pricing/engine.ts.
 * Uses the same JobCategory → TemplateJob → ServiceTemplate → MarketplaceJob
 * relationship contract enforced by production pricing.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { calculatePrice, validateQuotePrice } from '@/lib/pricing/engine'
import { PricingInput } from '@/lib/pricing/types'

const prisma = new PrismaClient()

describe('Phase 7 — Pricing Engine (DB)', () => {
  let testCategoryId: string
  let testTemplateJobId: string
  let testServiceTemplateId: string
  let testJobId: string

  beforeAll(async () => {
    const ts = Date.now()

    const category = await prisma.jobCategory.create({
      data: { name: `PE Test Category ${ts}`, slug: `pe-test-cat-${ts}`, isActive: true, sortOrder: 0, iconName: 'wrench', colorHex: '#000000', countries: '["LK"]' },
    })
    testCategoryId = category.id

    const templateJob = await prisma.templateJob.create({
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
    testTemplateJobId = templateJob.id

    const serviceTemplate = await prisma.serviceTemplate.create({
      data: {
        jobCategoryId: testCategoryId,
        templateJobId: testTemplateJobId,
        name: `PE Service Template ${ts}`,
        slug: `pe-service-template-${ts}`,
        description: 'Test pricing service template',
        questionsJson: '[]',
        defaultDurationMinutes: 60,
        priceMin: 3000,
        priceMax: 7000,
        currency: 'LKR',
        countryCode: 'LK',
        isActive: true,
      },
    })
    testServiceTemplateId = serviceTemplate.id

    const job = await prisma.marketplaceJob.create({
      data: {
        customerId: 'pe-test-customer',
        title: `PE Test Job ${ts}`,
        description: 'Test',
        categoryId: testCategoryId,
        serviceTemplateId: testServiceTemplateId,
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 20000n,
        status: 'OPEN',
        countryCode: 'LK',
      },
    })
    testJobId = job.id
  })

  afterAll(async () => {
    await prisma.marketplaceJob.delete({ where: { id: testJobId } }).catch(() => {})
    await prisma.serviceTemplate.delete({ where: { id: testServiceTemplateId } }).catch(() => {})
    await prisma.templateJob.delete({ where: { id: testTemplateJobId } }).catch(() => {})
    await prisma.jobCategory.delete({ where: { id: testCategoryId } }).catch(() => {})
  })

  it('BOOK_NOW with NORMAL urgency: base + 0 urgency + 0 modifiers + fee', async () => {
    const result = await calculatePrice(prisma, {
      jobId: testJobId,
      categoryId: testCategoryId,
      serviceTemplateId: testServiceTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'NORMAL',
    })

    expect(result.baseAmount).toBe(500000n)
    expect(result.urgencyAmount).toBe(0n)
    expect(result.serviceModifiers).toBe(0n)
    expect(result.providerGross).toBe(500000n)
    const expectedFee = (500000n * 1000n) / 10000n
    expect(result.platformFeeAmount).toBe(expectedFee)
    expect(result.customerTotal).toBe(result.providerGross + result.platformFeeAmount)
    expect(result.currency).toBe('LKR')
  })

  it('BOOK_NOW with URGENT: base + 25% urgency + fee', async () => {
    const result = await calculatePrice(prisma, {
      jobId: testJobId,
      categoryId: testCategoryId,
      serviceTemplateId: testServiceTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'URGENT',
    })
    expect(result.baseAmount).toBe(500000n)
    expect(result.urgencyAmount).toBe(125000n)
    expect(result.providerGross).toBe(625000n)
    expect(result.ruleIds).toContain('urgency_urgent')
  })

  it('BOOK_NOW with EMERGENCY: base + 50% urgency (capped at 100%) + fee', async () => {
    const result = await calculatePrice(prisma, {
      jobId: testJobId,
      categoryId: testCategoryId,
      serviceTemplateId: testServiceTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'EMERGENCY',
    })
    expect(result.urgencyAmount).toBe(250000n)
    expect(result.providerGross).toBe(750000n)
    expect(result.ruleIds).toContain('urgency_emergency')
  })

  it('QUOTE mode uses same formula with different base resolution', async () => {
    const result = await calculatePrice(prisma, {
      jobId: testJobId,
      categoryId: testCategoryId,
      mode: 'QUOTE',
      urgency: 'NORMAL',
    })
    expect(result.baseAmount).toBeGreaterThanOrEqual(500000n)
    expect(result.currency).toBe('LKR')
  })

  it('Multi-quantity pricing: quantity=3 adds modifiers', async () => {
    const result = await calculatePrice(prisma, {
      jobId: testJobId,
      categoryId: testCategoryId,
      serviceTemplateId: testServiceTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'NORMAL',
      quantity: 3,
    })
    expect(result.serviceModifiers).toBe(4000n)
    expect(result.ruleIds).toContain('service_modifiers')
  })

  it('Long duration pricing: >60min adds time modifiers', async () => {
    const result = await calculatePrice(prisma, {
      jobId: testJobId,
      categoryId: testCategoryId,
      serviceTemplateId: testServiceTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'NORMAL',
      durationMinutes: 120,
    })
    expect(result.serviceModifiers).toBe(3000n)
  })

  it('All amounts are BigInt (no Float)', async () => {
    const result = await calculatePrice(prisma, {
      jobId: testJobId,
      categoryId: testCategoryId,
      serviceTemplateId: testServiceTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'URGENT',
      quantity: 2,
      durationMinutes: 90,
    })
    expect(typeof result.baseAmount).toBe('bigint')
    expect(typeof result.urgencyAmount).toBe('bigint')
    expect(typeof result.serviceModifiers).toBe('bigint')
    expect(typeof result.providerGross).toBe('bigint')
    expect(typeof result.platformFeeAmount).toBe('bigint')
    expect(typeof result.customerTotal).toBe('bigint')
  })

  it('customerTotal = providerGross + platformFeeAmount', async () => {
    const result = await calculatePrice(prisma, {
      jobId: testJobId,
      categoryId: testCategoryId,
      serviceTemplateId: testServiceTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'EMERGENCY',
      quantity: 2,
      durationMinutes: 90,
    })
    expect(result.customerTotal).toBe(result.providerGross + result.platformFeeAmount)
  })

  it('providerGross = baseAmount + urgencyAmount + serviceModifiers', async () => {
    const result = await calculatePrice(prisma, {
      jobId: testJobId,
      categoryId: testCategoryId,
      serviceTemplateId: testServiceTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'URGENT',
      quantity: 3,
      durationMinutes: 150,
    })
    expect(result.providerGross).toBe(result.baseAmount + result.urgencyAmount + result.serviceModifiers)
  })

  it('Currency always LKR', async () => {
    const result = await calculatePrice(prisma, {
      jobId: testJobId,
      categoryId: testCategoryId,
      mode: 'BOOK_NOW',
      urgency: 'NORMAL',
    })
    expect(result.currency).toBe('LKR')
  })

  describe('validateQuotePrice', () => {
    it('positive price accepted', () => expect(validateQuotePrice(5000n, 10000n).valid).toBe(true))
    it('negative price rejected', () => expect(validateQuotePrice(-100n, 10000n).valid).toBe(false))
    it('zero price rejected', () => expect(validateQuotePrice(0n, 10000n).valid).toBe(false))
    it('price >3x budget rejected', () => {
      const result = validateQuotePrice(30_001n, 10_000n)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('3x')
    })
    it('price exactly 3x budget accepted', () => expect(validateQuotePrice(30_000n, 10_000n).valid).toBe(true))
    it('zero budget disables 3x check', () => expect(validateQuotePrice(100_000n, 0n).valid).toBe(true))
  })
})
