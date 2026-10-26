import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { authenticateMarketplaceUser, resolveCompanyContext, findMilestones } = vi.hoisted(() => ({
  authenticateMarketplaceUser: vi.fn(),
  resolveCompanyContext: vi.fn(),
  findMilestones: vi.fn(),
}))

vi.mock('@/lib/auth/marketplace-auth', () => ({ authenticateMarketplaceUser }))
vi.mock('@/lib/phase6/company-context', () => ({ resolveCompanyContext }))
vi.mock('@/lib/prisma', () => ({ prisma: { milestone: { findMany: findMilestones } } }))

import { GET } from '@/app/api/mobile/company/milestones/route'

function request() {
  return new NextRequest('https://maintainex.test/api/mobile/company/milestones?companyId=company-a')
}

describe('company milestone access follows role scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateMarketplaceUser.mockResolvedValue({ id: 'member-a', role: 'TASKER' })
    resolveCompanyContext.mockResolvedValue({ context: {
      companyId: 'company-a', role: 'WORKER', membershipId: 'member-a-membership',
    } })
    findMilestones.mockResolvedValue([])
  })

  it('does not query company-wide milestones for a worker without assignment-scoped contracts', async () => {
    const response = await GET(request())

    expect(response.status).toBe(403)
    expect(findMilestones).not.toHaveBeenCalled()
  })

  it('preserves company-wide milestone access for dispatchers with jobs:read', async () => {
    resolveCompanyContext.mockResolvedValue({ context: {
      companyId: 'company-a', role: 'DISPATCHER', membershipId: 'member-a-membership',
    } })

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(findMilestones).toHaveBeenCalledWith(expect.objectContaining({
      where: { contract: { companyId: 'company-a' } },
    }))
  })
})
