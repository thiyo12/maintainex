/**
 * Phase 7 — Pricing Idempotency Tests
 *
 * Verifies deterministic, side-effect-free pricing using the same validated
 * ServiceTemplate relationships required by production.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { calculatePrice } from '@/lib/pricing/engine'
import { PricingInput } from '@/lib/pricing/types'

const prisma = new PrismaClient()

describe('Phase 7 — Pricing Idempotency (DB)', () => {
  let categoryId: string
  let templateJobId: string
  let serviceTemplateId: string
  let jobId: string

  beforeAll(async () => {
    const ts = Date.now()

    const category = await prisma.jobCategory.create({
      data: { name: `Idem Test Category ${ts}`, slug: `idem-test-cat-${ts}`, isActive: true, sortOrder: 0, iconName: 'wrench', colorHex: '#000000', countries: '["LK"]' },
    })
    categoryId = category.id

    const templateJob = await prisma.templateJob.create({
      data: {
        categoryId,
        name: `Idem Test Template ${ts}`,
        description: 'Test',
        whatIsIncluded: '[]',
        typicalDurationMinutes: 60,
        priceMin: 2000,
        priceMax: 8000,
        countries: '["LK"]',
        isActive: true,
      },
    })
    templateJobId = templateJob.id

    const serviceTemplate = await prisma.serviceTemplate.create({
      data: {
        jobCategoryId: categoryId,
        templateJobId,
        name: `Idem Service Template ${ts}`,
        slug: `idem-service-template-${ts}`,
        description: 'Idempotency pricing fixture',
        questionsJson: '[]',
        defaultDurationMinutes: 60,
        priceMin: 2000,
        priceMax: 8000,
        currency: 'LKR',
        countryCode: 'LK',
        isActive: true,
      },
    })
    serviceTemplateId = serviceTemplate.id

    const job = await prisma.marketplaceJob.create({
      data: {
        customerId: 'idem-test-customer',
        title: `Idem Test Job ${ts}`,
        description: 'Test',
        categoryId,
        serviceTemplateId,
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 30000n,
        status: 'OPEN',
        countryCode: 'LK',
      },
    })
    jobId = job.id
  })

  afterAll(async () => {
    await prisma.marketplaceJob.delete({ where: { id: jobId } }).catch(() => {})
    await prisma.serviceTemplate.delete({ where: { id: serviceTemplateId } }).catch(() => {})
    await prisma.templateJob.delete({ where: { id: templateJobId } }).catch(() => {})
    await prisma.jobCategory.delete({ where: { id: categoryId } }).catch(() => {})
  })

  it('Same input produces same output (deterministic)', async () => {
    const input: PricingInput = {
      jobId,
      categoryId,
      serviceTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'URGENT',
      quantity: 2,
      durationMinutes: 90,
    }

    const result1 = await calculatePrice(prisma, input)
    const result2 = await calculatePrice(prisma, input)

    expect(result1.baseAmount).toBe(result2.baseAmount)
    expect(result1.urgencyAmount).toBe(result2.urgencyAmount)
    expect(result1.serviceModifiers).toBe(result2.serviceModifiers)
    expect(result1.providerGross).toBe(result2.providerGross)
    expect(result1.platformFeeAmount).toBe(result2.platformFeeAmount)
    expect(result1.customerTotal).toBe(result2.customerTotal)
    expect(result1.ruleIds).toEqual(result2.ruleIds)
  })

  it('Different urgency levels produce different totals', async () => {
    const baseInput: PricingInput = {
      jobId,
      categoryId,
      serviceTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'NORMAL',
    }

    const normal = await calculatePrice(prisma, { ...baseInput, urgency: 'NORMAL' })
    const urgent = await calculatePrice(prisma, { ...baseInput, urgency: 'URGENT' })
    const emergency = await calculatePrice(prisma, { ...baseInput, urgency: 'EMERGENCY' })

    expect(urgent.customerTotal).toBeGreaterThan(normal.customerTotal)
    expect(emergency.customerTotal).toBeGreaterThan(urgent.customerTotal)
    expect(normal.urgencyAmount).toBe(0n)
    expect(urgent.urgencyAmount).toBeGreaterThan(0n)
    expect(emergency.urgencyAmount).toBeGreaterThan(urgent.urgencyAmount)
  })

  it('Different categories produce different base amounts', async () => {
    const ts = Date.now()
    const otherCategory = await prisma.jobCategory.create({
      data: { name: `Idem Other Cat ${ts}`, slug: `idem-other-cat-${ts}`, isActive: true, sortOrder: 0, iconName: 'wrench', colorHex: '#000000', countries: '["LK"]' },
    })
    const otherTemplateJob = await prisma.templateJob.create({
      data: {
        categoryId: otherCategory.id,
        name: `Idem Other Template ${ts}`,
        description: 'Test',
        whatIsIncluded: '[]',
        typicalDurationMinutes: 60,
        priceMin: 1000,
        priceMax: 2000,
        countries: '["LK"]',
        isActive: true,
      },
    })
    const otherServiceTemplate = await prisma.serviceTemplate.create({
      data: {
        jobCategoryId: otherCategory.id,
        templateJobId: otherTemplateJob.id,
        name: `Idem Other Service ${ts}`,
        slug: `idem-other-service-${ts}`,
        description: 'Other pricing fixture',
        questionsJson: '[]',
        defaultDurationMinutes: 60,
        priceMin: 1000,
        priceMax: 2000,
        currency: 'LKR',
        countryCode: 'LK',
        isActive: true,
      },
    })
    const otherJob = await prisma.marketplaceJob.create({
      data: {
        customerId: 'idem-test-customer-b',
        title: `Idem Other Job ${ts}`,
        description: 'Test',
        categoryId: otherCategory.id,
        serviceTemplateId: otherServiceTemplate.id,
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 30000n,
        status: 'OPEN',
        countryCode: 'LK',
      },
    })

    try {
      const resultA = await calculatePrice(prisma, {
        jobId,
        categoryId,
        serviceTemplateId,
        mode: 'BOOK_NOW',
        urgency: 'NORMAL',
      })

      const resultB = await calculatePrice(prisma, {
        jobId: otherJob.id,
        categoryId: otherCategory.id,
        serviceTemplateId: otherServiceTemplate.id,
        mode: 'BOOK_NOW',
        urgency: 'NORMAL',
      })

      expect(resultA.baseAmount).not.toBe(resultB.baseAmount)
    } finally {
      await prisma.marketplaceJob.delete({ where: { id: otherJob.id } }).catch(() => {})
      await prisma.serviceTemplate.delete({ where: { id: otherServiceTemplate.id } }).catch(() => {})
      await prisma.templateJob.delete({ where: { id: otherTemplateJob.id } }).catch(() => {})
      await prisma.jobCategory.delete({ where: { id: otherCategory.id } }).catch(() => {})
    }
  })

  it('Price calculation is pure (no side effects)', async () => {
    const input: PricingInput = {
      jobId,
      categoryId,
      serviceTemplateId,
      mode: 'BOOK_NOW',
      urgency: 'NORMAL',
    }

    const beforeCount = await prisma.priceSnapshot.count({ where: { jobId } })
    await calculatePrice(prisma, input)
    await calculatePrice(prisma, input)
    const afterCount = await prisma.priceSnapshot.count({ where: { jobId } })
    expect(afterCount).toBe(beforeCount)
  })

  it('No Math.random() in pricing code (code inspection)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    for (const file of ['lib/pricing/engine.ts', 'lib/pricing/fees.ts', 'lib/pricing/snapshot.ts', 'lib/pricing/rules.ts']) {
      const fullPath = path.resolve(process.cwd(), file)
      if (fs.existsSync(fullPath)) {
        expect(fs.readFileSync(fullPath, 'utf-8')).not.toMatch(/Math\.random/)
      }
    }
  })
})
