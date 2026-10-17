import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { normalizeCompanyServiceAreas, normalizeCompanyServices } from '@/lib/phase6/company-profile-market'

const mocks = vi.hoisted(() => ({
  country: 'CA',
  profile: null as null | { id: string; countryCode: string },
  profileFind: vi.fn(),
  profileCreate: vi.fn(),
  profileUpdate: vi.fn(),
  transaction: vi.fn(),
  templateFind: vi.fn(),
  memberCreate: vi.fn(),
  resolveContext: vi.fn(),
}))

vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => ({
    id: 'owner', role: 'COMPANY', name: 'Owner',
    countryCode: mocks.country, isActive: true,
  }),
}))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    companyProfile: {
      findUnique: mocks.profileFind,
      update: mocks.profileUpdate,
    },
    templateJob: { findMany: mocks.templateFind },
    $transaction: mocks.transaction,
  },
}))
vi.mock('@/lib/phase6/company-context', () => ({
  resolveCompanyContext: mocks.resolveContext,
}))

async function put(payload: Record<string, unknown>) {
  const { PUT } = await import('@/app/api/mobile/company/profile/route')
  return PUT(new NextRequest('http://localhost/api/mobile/company/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }))
}

describe('Phase 04 — company service-area mutation cannot expand Canada', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.country = 'CA'
    mocks.profile = null
    mocks.profileFind.mockImplementation(async () => mocks.profile)
    mocks.templateFind.mockImplementation(async () => [{
      id: 'svc',
      currency: 'CAD',
      countries: '["CA"]',
      category: { countries: '["CA"]' },
    }])
    mocks.profileCreate.mockResolvedValue({ id: 'company', companyName: 'Company' })
    mocks.profileUpdate.mockResolvedValue({ id: 'company', companyName: 'Company' })
    mocks.transaction.mockImplementation(async (fn: Function) => fn({
      companyProfile: { create: mocks.profileCreate },
      teamMember: { create: mocks.memberCreate },
    }))
    mocks.resolveContext.mockResolvedValue({ context: {
      companyId: 'company', role: 'COMPANY_OWNER', membershipId: 'member',
    } })
  })

  it('rejects mixed Vancouver plus another municipality on initial registration', async () => {
    const result = await put({ companyName: 'Company', services: ['svc'], serviceAreas: ['Vancouver', 'Toronto'] })
    expect(result.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('rejects unsupported country accounts before registration', async () => {
    mocks.country = 'US'
    const result = await put({ companyName: 'Company', services: ['svc'], serviceAreas: ['Vancouver'] })
    expect(result.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('normalizes case and whitespace for sole Vancouver coverage', async () => {
    const response = await put({ companyName: 'Company', services: ['svc'], serviceAreas: [' vAnCoUvEr '] })
    expect(response.status).toBe(201)
    expect(mocks.profileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ serviceAreas: '["Vancouver"]', countryCode: 'CA' }),
    })
  })

  it('blocks an existing Canadian company changing coverage to Toronto', async () => {
    mocks.profile = { id: 'company', countryCode: 'CA' }
    const response = await put({ companyId: 'company', serviceAreas: ['Toronto'] })
    expect(response.status).toBe(400)
    expect(mocks.profileUpdate).not.toHaveBeenCalled()
  })

  it('blocks an existing Canadian company mixing Burnaby with Vancouver', async () => {
    mocks.profile = { id: 'company', countryCode: 'CA' }
    const response = await put({ companyId: 'company', serviceAreas: ['Vancouver', 'Burnaby'] })
    expect(response.status).toBe(400)
    expect(mocks.profileUpdate).not.toHaveBeenCalled()
  })

  it('blocks a Canadian company from removing Vancouver coverage', async () => {
    mocks.profile = { id: 'company', countryCode: 'CA' }
    const response = await put({ companyId: 'company', serviceAreas: [] })
    expect(response.status).toBe(400)
  })

  it('normalizes a permitted Canadian coverage update before persistence', async () => {
    mocks.profile = { id: 'company', countryCode: 'CA' }
    const response = await put({ companyId: 'company', serviceAreas: ['vancouver'] })
    expect(response.status).toBe(200)
    expect(mocks.profileUpdate).toHaveBeenCalledWith({
      where: { id: 'company' },
      data: expect.objectContaining({ serviceAreas: '["Vancouver"]' }),
    })
  })

  it('rejects editing a company belonging to a different account market', async () => {
    mocks.profile = { id: 'company', countryCode: 'LK' }
    const response = await put({ companyId: 'company', companyName: 'Changed' })
    expect(response.status).toBe(403)
    expect(mocks.profileUpdate).not.toHaveBeenCalled()
  })

  it('retains existing Canadian coverage when only the name is edited', async () => {
    mocks.profile = { id: 'company', countryCode: 'CA' }
    const response = await put({ companyId: 'company', companyName: 'Updated' })
    expect(response.status).toBe(200)
    expect(mocks.profileUpdate).toHaveBeenCalledWith({
      where: { id: 'company' },
      data: expect.objectContaining({ serviceAreas: undefined }),
    })
  })

  it('rejects malformed service declarations instead of serializing arbitrary objects', async () => {
    mocks.profile = { id: 'company', countryCode: 'CA' }
    const response = await put({ companyId: 'company', services: { admin: true } })
    expect(response.status).toBe(400)
    expect(mocks.profileUpdate).not.toHaveBeenCalled()
  })

  it('retains Sri Lankan legacy-area labels without inventing foreign restrictions', () => {
    expect(normalizeCompanyServiceAreas('LK', ['Negombo', 'Colombo']))
      .toEqual({ ok: true, areas: ['Negombo', 'Colombo'] })
  })

  it('rejects invalid list contents and does not treat an empty service as a capability', () => {
    expect(normalizeCompanyServices(['', 'plumbing']).ok).toBe(false)
    expect(normalizeCompanyServices([{}, 'plumbing']).ok).toBe(false)
    expect(normalizeCompanyServices(['plumbing', ' plumbing ']))
      .toEqual({ ok: true, services: ['plumbing'] })
  })
})
