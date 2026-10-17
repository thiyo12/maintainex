import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { validateCompanyCatalogueServices } from '@/lib/phase6/company-profile-market'

const mock = vi.hoisted(() => ({
  country: 'CA',
  profile: null as null | { id: string; countryCode: string; services: string },
  find: vi.fn(),
  templateFind: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  memberCreate: vi.fn(),
  transaction: vi.fn(),
  context: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: {
  companyProfile: { findUnique: mock.find, update: mock.update },
  templateJob: { findMany: mock.templateFind },
  $transaction: mock.transaction,
} }))
vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => ({
    id: 'owner', name: 'Owner', role: 'COMPANY', countryCode: mock.country,
    isActive: true,
  }),
}))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({ assertNotSuspended: () => null }))
vi.mock('@/lib/phase6/company-context', () => ({ resolveCompanyContext: mock.context }))

function valid(id: string, country: string, currency: string = country === 'CA' ? 'CAD' : 'LKR') {
  return { id, countries: JSON.stringify([country]), currency,
    category: { countries: JSON.stringify([country]) } }
}
async function submit(data: Record<string, unknown>) {
  const { PUT } = await import('@/app/api/mobile/company/profile/route')
  return PUT(new NextRequest('http://localhost/api/mobile/company/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
    headers: { 'content-type': 'application/json' },
  }))
}

describe('Phase 04 — company service claims are canonical and market-safe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.country = 'CA'
    mock.profile = null
    mock.find.mockImplementation(async () => mock.profile)
    mock.templateFind.mockImplementation(async () => [valid('ca-service', 'CA')])
    mock.create.mockResolvedValue({ id: 'company', companyName: 'Company' })
    mock.update.mockResolvedValue({ id: 'company', companyName: 'Company' })
    mock.transaction.mockImplementation(async (fn: Function) => fn({
      companyProfile: { create: mock.create },
      teamMember: { create: mock.memberCreate },
    }))
    mock.context.mockResolvedValue({ context: {
      companyId: 'company', membershipId: 'owner-member', role: 'COMPANY_OWNER',
    } })
  })

  it('accepts an active local-currency canonical service at creation', async () => {
    const res = await submit({ companyName: 'Company', services: ['ca-service'], serviceAreas: ['Vancouver'] })
    expect(res.status).toBe(201)
    expect(mock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ services: '["ca-service"]', countryCode: 'CA' }),
    })
  })

  it('rejects a fabricated canonical service ID before creating a company', async () => {
    const res = await submit({ companyName: 'Company', services: ['fake-service'], serviceAreas: ['Vancouver'] })
    expect(res.status).toBe(400)
    expect(mock.transaction).not.toHaveBeenCalled()
  })

  it('rejects another market service even when its ID is known', async () => {
    mock.templateFind.mockResolvedValue([valid('lk-service', 'LK')])
    const res = await submit({ companyName: 'Company', services: ['lk-service'], serviceAreas: ['Vancouver'] })
    expect(res.status).toBe(400)
    expect(mock.transaction).not.toHaveBeenCalled()
  })

  it('rejects cross-currency and wrong-market categories independently', async () => {
    const client = { templateJob: { findMany: vi.fn()
      .mockResolvedValue([valid('a', 'CA', 'LKR')]) } } as any
    expect(await validateCompanyCatalogueServices(client, 'CA', ['a'])).toBe(true)
    // The database query must select CAD, active jobs, active categories.
    expect(client.templateJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        currency: 'CAD', isActive: true,
        category: { isActive: true },
      }),
    }))
    client.templateJob.findMany.mockResolvedValue([{ ...valid('a', 'CA'), category: { countries: '["LK"]' } }])
    expect(await validateCompanyCatalogueServices(client, 'CA', ['a'])).toBe(false)
  })

  it('rejects new free-form services on a verified existing company profile', async () => {
    mock.profile = { id: 'company', countryCode: 'CA', services: '["ca-service"]' }
    const res = await submit({ companyId: 'company', services: ['Custom handyman service'] })
    expect(res.status).toBe(400)
    expect(mock.update).not.toHaveBeenCalled()
  })

  it('preserves an identical historical freeform list when other fields are changed', async () => {
    mock.profile = { id: 'company', countryCode: 'CA', services: '["Historic service label"]' }
    const res = await submit({ companyId: 'company', companyName: 'Updated',
      services: ['Historic service label'] })
    expect(res.status).toBe(200)
    expect(mock.templateFind).not.toHaveBeenCalled()
  })

  it('does not need catalogue lookup when services are omitted on metadata-only edits', async () => {
    mock.profile = { id: 'company', countryCode: 'CA', services: '["Historic service label"]' }
    const res = await submit({ companyId: 'company', description: 'Updated' })
    expect(res.status).toBe(200)
    expect(mock.templateFind).not.toHaveBeenCalled()
    expect(mock.update).toHaveBeenCalledWith({
      where: { id: 'company' },
      data: expect.objectContaining({ services: undefined }),
    })
  })

  it('accepts catalogue-ID updates without reactivating inactive template IDs', async () => {
    mock.profile = { id: 'company', countryCode: 'CA', services: '["historic"]' }
    const res = await submit({ companyId: 'company', services: ['ca-service'] })
    expect(res.status).toBe(200)
    expect(mock.update).toHaveBeenCalledWith({
      where: { id: 'company' },
      data: expect.objectContaining({ services: '["ca-service"]' }),
    })
  })
})
