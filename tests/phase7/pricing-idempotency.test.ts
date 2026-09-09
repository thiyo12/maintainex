/**
 * Phase 7 — Pricing Idempotency Tests
 *
 * Verifies that the pricing engine is deterministic and pure:
 * - Same input → same output
 * - Different inputs → different outputs
 * - No side effects or randomness in pricing code
 *
 * Requires VPS PostgreSQL with seeded data.
 * Run on VPS only.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { calculatePrice } from '@/lib/pricing/engine'
import { PricingInput } from '@/lib/pricing/types'

const prisma = new PrismaClient()

describe('Phase 7 — Pricing Idempotency (DB)', () => {
  let categoryId: string
  let templateId: string
  let jobId: string

  beforeAll(async () => {
    try {
    const ts = Date.now()

    const category = await prisma.jobCategory.create({
      data: { name: `Idem Test Category ${ts}`, slug: `idem-test-cat-${ts}`, isActive: true, sortOrder: 0, iconName: 'wrench', colorHex: '#000000', countries: '["LK"]' },
    })
    categoryId = category.id

    const template = await prisma.templateJob.create({
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
    templateId = template.id

    const job = await prisma.marketplaceJob.create({
      data: {
        customerId: 'idem-test-customer',
        title: `Idem Test Job ${ts}`,
        description: 'Test',
        categoryId,
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 30000n,
        status: 'OPEN',
      },
    })
    jobId = job.id
    } catch { /* DB unavailable locally */ }
  })

  afterAll(async () => {
    await prisma.marketplaceJob.delete({ where: { id: jobId } }).catch(() => {})
    await prisma.templateJob.delete({ where: { id: templateId } }).catch(() => {})
    await prisma.jobCategory.delete({ where: { id: categoryId } }).catch(() => {})
  })

  // ── Deterministic output ─────────────────────────────────────────

  it('Same input produces same output (deterministic)', async () => {
    const input: PricingInput = {
      jobId,
      categoryId,
      serviceTemplateId: templateId,
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

  // ── Different urgency → different totals ─────────────────────────

  it('Different urgency levels produce different totals', async () => {
    const baseInput: PricingInput = {
      jobId,
      categoryId,
      serviceTemplateId: templateId,
      mode: 'BOOK_NOW',
      urgency: 'NORMAL',
    }

    const normal = await calculatePrice(prisma, { ...baseInput, urgency: 'NORMAL' })
    const urgent = await calculatePrice(prisma, { ...baseInput, urgency: 'URGENT' })
    const emergency = await calculatePrice(prisma, { ...baseInput, urgency: 'EMERGENCY' })

    // Urgency increases the total
    expect(urgent.customerTotal).toBeGreaterThan(normal.customerTotal)
    expect(emergency.customerTotal).toBeGreaterThan(urgent.customerTotal)

    // Urgency amounts are different
    expect(normal.urgencyAmount).toBe(0n)
    expect(urgent.urgencyAmount).toBeGreaterThan(0n)
    expect(emergency.urgencyAmount).toBeGreaterThan(urgent.urgencyAmount)
  })

  // ── Different categories → different base amounts ────────────────

  it('Different categories produce different base amounts', async () => {
    const ts = Date.now()
    const otherCategory = await prisma.jobCategory.create({
      data: { name: `Idem Other Cat ${ts}`, slug: `idem-other-cat-${ts}`, isActive: true, sortOrder: 0, iconName: 'wrench', colorHex: '#000000', countries: '["LK"]' },
    })
    const otherTemplate = await prisma.templateJob.create({
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

    const resultA = await calculatePrice(prisma, {
      jobId,
      categoryId,
      serviceTemplateId: templateId,
      mode: 'BOOK_NOW',
      urgency: 'NORMAL',
    })

    const resultB = await calculatePrice(prisma, {
      jobId,
      categoryId: otherCategory.id,
      serviceTemplateId: otherTemplate.id,
      mode: 'BOOK_NOW',
      urgency: 'NORMAL',
    })

    expect(resultA.baseAmount).not.toBe(resultB.baseAmount)

    await prisma.templateJob.delete({ where: { id: otherTemplate.id } }).catch(() => {})
    await prisma.jobCategory.delete({ where: { id: otherCategory.id } }).catch(() => {})
  })

  // ── Pure function (no side effects) ──────────────────────────────

  it('Price calculation is pure (no side effects)', async () => {
    const input: PricingInput = {
      jobId,
      categoryId,
      serviceTemplateId: templateId,
      mode: 'BOOK_NOW',
      urgency: 'NORMAL',
    }

    // Count PriceSnapshot rows before
    const beforeCount = await prisma.priceSnapshot.count({ where: { jobId } })

    await calculatePrice(prisma, input)
    await calculatePrice(prisma, input)

    // PriceSnapshot count should not change (calculatePrice doesn't write snapshots)
    const afterCount = await prisma.priceSnapshot.count({ where: { jobId } })
    expect(afterCount).toBe(beforeCount)
  })

  // ── No Math.random in pricing code ───────────────────────────────

  it('No Math.random() in pricing code (code inspection)', async () => {
    const fs = await import('fs')
    const path = await import('path')

    const files = [
      'lib/pricing/engine.ts',
      'lib/pricing/fees.ts',
      'lib/pricing/snapshot.ts',
      'lib/pricing/rules.ts',
    ]

    for (const file of files) {
      const fullPath = path.resolve(process.cwd(), file)
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8')
        expect(content).not.toMatch(/Math\.random/)
      }
    }
  })
})
