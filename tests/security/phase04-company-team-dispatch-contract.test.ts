import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({ members: vi.fn(), invites: vi.fn(), identities: vi.fn() }))
vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => ({ id: 'owner' }),
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/phase6/company-context', () => ({
  resolveCompanyContext: async () => ({
    context: { companyId: 'company', role: 'COMPANY_OWNER' }, error: null,
  }),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    teamMember: { findMany: mock.members },
    teamInvite: { findMany: mock.invites },
    providerIdentity: { findMany: mock.identities },
  },
}))
const member = (userId: string, status: string, userOverrides: Record<string, unknown> = {}) => ({
  id: userId, userId, name: userId, role: 'WORKER', status,
  skills: '[]', isOnline: false, rating: 0, completedJobs: 0,
  joinedAt: new Date('2026-01-01'),
  user: {
    identityStatus: 'VERIFIED', isActive: true, isSuspended: false, isBanned: false,
    ...userOverrides,
  },
})
describe('Phase 04 — team read contract and dispatch client workforce', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.members.mockResolvedValue([
      member('active', 'ACTIVE'),
      member('suspended', 'SUSPENDED'),
      member('banned', 'ACTIVE', { isBanned: true }),
      member('inactive', 'ACTIVE', { isActive: false }),
    ])
    mock.invites.mockResolvedValue([])
    mock.identities.mockResolvedValue([
      { currentUserId: 'active', kycStatus: 'VERIFIED', verifiedPhotoUrl: 'approved' },
      { currentUserId: 'suspended', kycStatus: 'VERIFIED', verifiedPhotoUrl: 'stale' },
      { currentUserId: 'banned', kycStatus: 'VERIFIED', verifiedPhotoUrl: 'stale-banned' },
    ])
  })

  it('sends actual membership status and hides suspended identity photos', async () => {
    const { GET } = await import('@/app/api/mobile/company/team/route')
    const response = await GET(new NextRequest('http://localhost/api/mobile/company/team?companyId=company'))
    expect(response.status).toBe(200)
    expect(mock.members).toHaveBeenCalledWith(expect.objectContaining({
      where: { companyId: 'company', status: { not: 'REMOVED' } },
    }))
    const body = await response.json()
    expect(body.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: 'active', status: 'ACTIVE', workerAccountEligible: true, identityVerified: true }),
      expect.objectContaining({ userId: 'suspended', status: 'SUSPENDED', workerAccountEligible: false, identityVerified: false, verifiedPhotoUrl: null }),
      expect.objectContaining({ userId: 'banned', status: 'ACTIVE', workerAccountEligible: false, identityVerified: false, verifiedPhotoUrl: null }),
      expect.objectContaining({ userId: 'inactive', status: 'ACTIVE', workerAccountEligible: false, identityVerified: false, verifiedPhotoUrl: null }),
    ]))
    expect(mock.identities).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ currentUserId: { in: ['active'] } }),
    }))
  })

  it('mobile dispatch selects only active workers for accepted single-worker jobs', () => {
    const screen = readFileSync(resolve(process.cwd(),
      'apps/mobile/features/company/screens/workforce/assign.tsx'), 'utf8')
    expect(screen).toContain("member.status === 'ACTIVE'")
    expect(screen).toContain("member.role === 'WORKER'")
    expect(screen).toContain('member.workerAccountEligible === true')
    expect(screen).toContain("job.status === 'QUOTE_ACCEPTED'")
    expect(screen).toContain("v2Jobs.get(job.id, 'company')")
    expect(screen).toContain('(job.workersCount ?? 1) === 1')
    expect(screen).toContain('workerIdentityCheckRequired && !selectedWorkerData?.identityVerified')
  })
})
