import { describe, expect, it, vi } from 'vitest'
import { calculatePrice, PricingInputError } from '@/lib/pricing/engine'

// No database or payments are touched: malformed modifiers must fail before
// any price lookup, market config read, or amount calculation.
describe('Phase 05 pricing modifier input integrity', () => {
  it.each([
    ['quantity', 0], ['quantity', -1], ['quantity', 1.5],
    ['quantity', Number.NaN], ['quantity', Number.POSITIVE_INFINITY],
    ['quantity', Number.MAX_SAFE_INTEGER + 1],
    ['durationMinutes', 0], ['durationMinutes', -30],
    ['durationMinutes', 60.5], ['durationMinutes', Number.NaN],
    ['durationMinutes', Number.NEGATIVE_INFINITY],
    ['durationMinutes', Number.MAX_SAFE_INTEGER + 1],
  ] as const)('rejects invalid %s=%s without touching the DB', async (field, value) => {
    const client = {
      marketplaceJob: { findUnique: vi.fn() },
      jobCategory: { findUnique: vi.fn() },
      serviceTemplate: { findUnique: vi.fn() },
    }
    await expect(calculatePrice(client as any, {
      categoryId: 'unused-category', [field]: value,
    } as any)).rejects.toBeInstanceOf(PricingInputError)
    expect(client.marketplaceJob.findUnique).not.toHaveBeenCalled()
    expect(client.jobCategory.findUnique).not.toHaveBeenCalled()
    expect(client.serviceTemplate.findUnique).not.toHaveBeenCalled()
  })
})
