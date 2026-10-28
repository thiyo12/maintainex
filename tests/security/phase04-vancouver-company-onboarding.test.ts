import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mock = vi.hoisted(() => ({
  country: 'CA',
  profileFind: vi.fn(),
  profileCreate: vi.fn(),
  memberCreate: vi.fn(),
  transaction: vi.fn(),
  templateFind: vi.fn(),
}))

vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => ({
    id: 'owner', name: 'Owner', role: 'COMPANY',
    countryCode: mock.country, isActive: true,
  }),
}))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    companyProfile: { findUnique: mock.profileFind },
    templateJob: { findMany: mock.templateFind },
    $transaction: mock.transaction,
  },
}))
vi.mock('@/lib/phase6/company-context', () => ({
  resolveCompanyContext: vi.fn(),
}))

async function createCompany(serviceAreas: string[]) {
  const { PUT } = await import('@/app/api/mobile/company/profile/route')
  return PUT(new NextRequest('http://localhost/api/mobile/company/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      companyName: 'Location company',
      services: ['service-1'],
      serviceAreas,
    }),
  }))
}

describe('Phase 04 — new Vancouver company onboarding', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.country = 'CA'
    mock.profileFind.mockResolvedValue(null)
    mock.templateFind.mockImplementation(async () => [{
      id: 'service-1',
      currency: mock.country === 'CA' ? 'CAD' : 'LKR',
      countries: JSON.stringify([mock.country]),
      category: { countries: JSON.stringify([mock.country]) },
    }])
    mock.profileCreate.mockResolvedValue({ id: 'company', companyName: 'Location company' })
    mock.memberCreate.mockResolvedValue({ id: 'owner-member' })
    mock.transaction.mockImplementation(async (callback: Function) => callback({
      companyProfile: { create: mock.profileCreate },
      teamMember: { create: mock.memberCreate },
    }))
  })

  it('refuses blank new Canadian company coverage before any database writes', async () => {
    const res = await createCompany([])
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('Vancouver')
    expect(mock.transaction).not.toHaveBeenCalled()
  })

  it('refuses unsupported nearby Canadian municipalities as coverage', async () => {
    const res = await createCompany(['Burnaby'])
    expect(res.status).toBe(400)
    expect(mock.transaction).not.toHaveBeenCalled()
  })

  it('creates a Canadian company only with explicit Vancouver coverage', async () => {
    const res = await createCompany(['Vancouver'])
    expect(res.status).toBe(201)
    expect(mock.profileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        countryCode: 'CA',
        serviceAreas: '["Vancouver"]',
      }),
    })
    expect(mock.memberCreate).toHaveBeenCalledOnce()
  })

  it('preserves blank-coverage registration for legacy Sri Lankan companies', async () => {
    mock.country = 'LK'
    const res = await createCompany([])
    expect(res.status).toBe(201)
    expect(mock.profileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ countryCode: 'LK', serviceAreas: '[]' }),
    })
  })

  it('includes account market in the mobile authentication profile', () => {
    const me = readFileSync(resolve(process.cwd(), 'app/api/mobile/auth/me/route.ts'), 'utf8')
    expect(me).toContain('identityStatus: true, nickname: true, countryCode: true')
    const types = readFileSync(resolve(process.cwd(), 'apps/mobile/lib/types.ts'), 'utf8')
    expect(types).toContain('countryCode?: string')
  })

  it('scopes selectable jobs and requires a conscious Vancouver declaration', () => {
    const onboarding = readFileSync(resolve(process.cwd(), 'apps/mobile/features/auth/screens/onboarding/company-setup.tsx'), 'utf8')
    expect(onboarding).toContain('/api/mobile/job-categories?country=')
    expect(onboarding).toContain('const [servesVancouver, setServesVancouver] = useState(false)')
    expect(onboarding).toContain("serviceAreas: market === 'CA' && servesVancouver ? ['Vancouver'] : []")
    expect(onboarding).toContain('accessibilityRole="checkbox"')
  })
})
