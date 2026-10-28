import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { authenticateMarketplaceUser, resolveCompanyContext, db } = vi.hoisted(() => ({
  authenticateMarketplaceUser: vi.fn(),
  resolveCompanyContext: vi.fn(),
  db: { profile: vi.fn(), contracts: vi.fn() },
}))

vi.mock('@/lib/auth/marketplace-auth', () => ({ authenticateMarketplaceUser }))
vi.mock('@/lib/phase6/company-context', () => ({ resolveCompanyContext }))
vi.mock('@/lib/prisma', () => ({
  prisma: { companyProfile: { findUnique: db.profile }, contract: { findMany: db.contracts } },
}))

import { GET } from '@/app/api/mobile/company/profile/route'

const contract = {
  id: 'contract-private', clientName: 'Synthetic Private Client', title: 'Sensitive project',
  value: 125000, status: 'IN_PROGRESS', progress: 20, startDate: null, endDate: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
}

function request() {
  return new NextRequest('https://maintainex.test/api/mobile/company/profile?companyId=company-a')
}

describe('company profile finance data authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateMarketplaceUser.mockResolvedValue({ id: 'member-a', role: 'TASKER' })
    resolveCompanyContext.mockResolvedValue({ context: {
      companyId: 'company-a', role: 'DISPATCHER', membershipId: 'member-a-membership',
    } })
    db.profile.mockResolvedValue({
      id: 'company-a', userId: 'owner-a', companyName: 'Synthetic Co', registrationNo: null,
      description: null, services: '[]', serviceAreas: '[]', rating: 0, completedProjects: 0,
      isVerified: false, logo: null, createdAt: new Date('2026-01-01T00:00:00Z'), teamMembers: [],
    })
    db.contracts.mockResolvedValue([contract])
  })

  it('does not query or return client and contract finance data to dispatchers', async () => {
    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.recentContracts).toEqual([])
    expect(db.contracts).not.toHaveBeenCalled()
  })

  it('preserves recent contract details for an explicitly finance-authorized role', async () => {
    resolveCompanyContext.mockResolvedValue({ context: {
      companyId: 'company-a', role: 'FINANCE', membershipId: 'member-a-membership',
    } })

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(db.contracts).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: 'company-a' } }))
    expect(body.recentContracts).toMatchObject([{ clientName: 'Synthetic Private Client', value: 125000 }])
  })
})
