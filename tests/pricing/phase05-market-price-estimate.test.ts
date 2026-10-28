import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fake = vi.hoisted(() => ({
  category: vi.fn(),
  template: vi.fn(),
  config: vi.fn(),
  calculate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    jobCategory: { findUnique: fake.category },
    serviceTemplate: { findUnique: fake.template },
    marketConfig: { findUnique: fake.config },
  },
}))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: async () => ({ id: 'customer', countryCode: 'LK', role: 'CUSTOMER' }),
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/pricing/engine', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/pricing/engine')>()
  return { ...actual, calculatePrice: fake.calculate }
})

async function estimate(body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/mobile/v2/price-estimate/route')
  return POST(new NextRequest('http://localhost/api/mobile/v2/price-estimate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

describe('Phase 05 — legacy estimate must obey independent local pricing', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    fake.category.mockResolvedValue({ isActive: true, countries: '["LK","CA"]' })
    fake.template.mockResolvedValue({
      id: 'template', jobCategoryId: 'category',
      isActive: true, countryCode: 'CA', currency: 'CAD',
      priceMin: 100, priceMax: 200, defaultDurationMinutes: 60,
    })
    fake.config.mockResolvedValue({ defaultCurrency: 'CAD' })
    fake.calculate.mockResolvedValue({
      currency: 'CAD', baseAmount: 10000n, customerTotal: 11000n,
      urgencyAmount: 0n, serviceModifiers: 0n, platformFeeAmount: 1000n,
      providerGross: 10000n, platformFeeBps: 1000,
      pricingVersion: 'v1', ruleIds: [],
    })
  })

  it('refuses unsupported market codes before calculating a price', async () => {
    const response = await estimate({ categoryId: 'category', countryCode: 'US' })
    expect(response.status).toBe(400)
    expect(fake.calculate).not.toHaveBeenCalled()
  })

  it('refuses Canadian category-only estimates without verified local template', async () => {
    const response = await estimate({ categoryId: 'category', countryCode: 'CA' })
    expect(response.status).toBe(422)
    expect(fake.calculate).not.toHaveBeenCalled()
  })

  it('refuses an LKR template when a caller requests CAD', async () => {
    fake.template.mockResolvedValue({
      id: 'template', jobCategoryId: 'category',
      isActive: true, countryCode: 'LK', currency: 'LKR',
    })
    const response = await estimate({ templateId: 'template', categoryId: 'category', countryCode: 'CA' })
    expect(response.status).toBe(422)
    expect(fake.calculate).not.toHaveBeenCalled()
  })

  it('requires configured CAD pricing rather than silently inheriting global LKR seed', async () => {
    fake.config.mockResolvedValue({ defaultCurrency: 'LKR' })
    const response = await estimate({ templateId: 'template', categoryId: 'category', countryCode: 'CA' })
    expect(response.status).toBe(422)
    expect(fake.calculate).not.toHaveBeenCalled()
  })

  it('refuses a different category for a supplied service template', async () => {
    const response = await estimate({ templateId: 'template', categoryId: 'wrong', countryCode: 'CA' })
    expect(response.status).toBe(400)
    expect(fake.calculate).not.toHaveBeenCalled()
  })

  it('rejects false CAD result even when local CAD configuration is valid', async () => {
    fake.calculate.mockResolvedValue({
      currency: 'LKR', baseAmount: 10000n, customerTotal: 11000n,
    })
    const response = await estimate({ templateId: 'template', categoryId: 'category', countryCode: 'CA' })
    expect(response.status).toBe(422)
    expect(fake.calculate).toHaveBeenCalledOnce()
  })

  it('allows verified CAD templates and returns CAD-labelled major units', async () => {
    const response = await estimate({ templateId: 'template', categoryId: 'category', countryCode: 'CA' })
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.currency).toBe('CAD')
    expect(result.priceRange.min).toBeGreaterThan(0)
    expect(fake.calculate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ countryCode: 'CA' }))
  })

  it.each([1.5, '2.5', true, 9007199254740992])(
    'rejects fractional, nonnumeric or unsafe quantity input: %s', async quantity => {
      const { POST } = await import('@/app/api/mobile/v2/pricing/estimate/route')
      const response = await POST(new NextRequest('http://localhost/api/mobile/v2/pricing/estimate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          categoryId: 'category', serviceTemplateId: 'template',
          countryCode: 'CA', quantity,
        }),
      }))
      expect(response.status).toBe(400)
      expect(fake.calculate).not.toHaveBeenCalled()
    },
  )

  it('preserves an integer quantity for the canonical pricing engine', async () => {
    const { POST } = await import('@/app/api/mobile/v2/pricing/estimate/route')
    const response = await POST(new NextRequest('http://localhost/api/mobile/v2/pricing/estimate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        categoryId: 'category', serviceTemplateId: 'template',
        countryCode: 'CA', quantity: '3',
      }),
    }))
    expect(response.status).toBe(200)
    expect(fake.calculate).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ quantity: 3, countryCode: 'CA' }),
    )
  })

  it('refuses inactive market category before using any price template', async () => {
    fake.category.mockResolvedValue({ isActive: false, countries: '["CA"]' })
    const response = await estimate({ templateId: 'template', categoryId: 'category', countryCode: 'CA' })
    expect(response.status).toBe(400)
    expect(fake.calculate).not.toHaveBeenCalled()
  })
})

describe('Phase 05 — canonical category-level price selection', () => {
  it('does not use the old mixed-market template job lookup', () => {
    const code = readFileSync(resolve(process.cwd(), 'lib/pricing/engine.ts'), 'utf8')
    expect(code).toContain('countries: { contains: JSON.stringify(market) }')
    expect(code).toContain('currency: expectedCurrency')
    expect(code).toContain("if (market === 'CA')")
  })
})
