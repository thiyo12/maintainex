import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  assertNotSuspended: vi.fn(() => null),
  taskerProfileFindUnique: vi.fn(),
  companyProfileFindUnique: vi.fn(),
  teamMemberFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  securityAuditCreate: vi.fn(),
  createMarketplaceAuthSession: vi.fn(),
  buildAuthResponse: vi.fn(),
}))

vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: mocks.authenticateRequest,
  assertNotSuspended: mocks.assertNotSuspended,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    taskerProfile: { findUnique: mocks.taskerProfileFindUnique },
    companyProfile: { findUnique: mocks.companyProfileFindUnique },
    teamMember: { findFirst: mocks.teamMemberFindFirst },
    user: { update: mocks.userUpdate },
    securityAudit: { create: mocks.securityAuditCreate },
  },
}))

vi.mock('@/lib/auth/marketplace-session', () => ({
  createMarketplaceAuthSession: mocks.createMarketplaceAuthSession,
  buildAuthResponse: mocks.buildAuthResponse,
}))

function request(role: string) {
  return new NextRequest('http://localhost/api/mobile/auth/switch-role', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role }),
  })
}

describe('Release gate — persona switching authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authenticateRequest.mockResolvedValue({
      id: 'user-1',
      email: 'user@test.local',
      name: 'User',
      role: 'CUSTOMER',
      isActive: true,
    })
    mocks.assertNotSuspended.mockReturnValue(null)
    mocks.taskerProfileFindUnique.mockResolvedValue(null)
    mocks.companyProfileFindUnique.mockResolvedValue(null)
    mocks.teamMemberFindFirst.mockResolvedValue(null)
  })

  it('blocks switching to COMPANY without ownership or active membership', async () => {
    const { PUT } = await import('@/app/api/mobile/auth/switch-role/route')
    const response = await PUT(request('COMPANY'))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toContain('Company membership')
    expect(mocks.userUpdate).not.toHaveBeenCalled()
  })

  it('blocks switching to TASKER without a TaskerProfile', async () => {
    const { PUT } = await import('@/app/api/mobile/auth/switch-role/route')
    const response = await PUT(request('TASKER'))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toContain('Tasker profile')
    expect(mocks.userUpdate).not.toHaveBeenCalled()
  })

  it('rejects legacy PROVIDER persona instead of granting an unbacked role', async () => {
    const { PUT } = await import('@/app/api/mobile/auth/switch-role/route')
    const response = await PUT(request('PROVIDER'))

    expect(response.status).toBe(400)
    expect(mocks.userUpdate).not.toHaveBeenCalled()
  })
})
