import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revokeAssignment } from '@/lib/domain/company-job-assignment'
const mock = vi.hoisted(() => ({
  member: vi.fn(), assignment: vi.fn(), lock: vi.fn(),
  claim: vi.fn(), restore: vi.fn(), audit: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    teamMember: { findFirst: mock.member },
    companyJobAssignment: { findUnique: mock.assignment },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      $queryRaw: mock.lock,
      companyJobAssignment: { updateMany: mock.claim },
      marketplaceJob: { updateMany: mock.restore },
    }),
  },
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: mock.audit }))
vi.mock('@/lib/phase6/provider-eligibility', () => ({ checkWorkerEligibility: vi.fn() }))
vi.mock('@/lib/security/events', () => ({ emitSecurityEvent: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ notifyCompanyWorkerAssigned: vi.fn() }))

describe('Phase 04 — revocation checks permissions and work-start at commit', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.member.mockResolvedValue({ role: 'COMPANY_OWNER' })
    mock.assignment.mockResolvedValue({
      id: 'assignment', companyId: 'company', jobId: 'job',
      workerUserId: 'worker', status: 'ACCEPTED',
    })
    mock.lock.mockImplementation(async (strings: TemplateStringsArray) =>
      strings.join(' ').includes('FROM "User"')
        ? [{ isActive: true, isSuspended: false, isBanned: false }]
        : [{ role: 'COMPANY_OWNER', status: 'ACTIVE' }],
    )
    mock.claim.mockResolvedValue({ count: 1 })
    mock.restore.mockResolvedValue({ count: 1 })
  })

  it('locks actor authority and conditionally revokes pre-start work', async () => {
    expect(await revokeAssignment('assignment', 'company', 'owner', 'COMPANY_OWNER'))
      .toEqual({ success: true, assignmentId: 'assignment' })
    expect(mock.lock).toHaveBeenCalledTimes(2)
    expect(mock.claim).toHaveBeenCalledWith({
      where: {
        id: 'assignment', companyId: 'company', workerUserId: 'worker',
        status: { in: ['ASSIGNED', 'ACCEPTED'] },
        job: { status: 'QUOTE_ACCEPTED', targetTaskerId: 'worker' },
      },
      data: { status: 'REVOKED', revokedAt: expect.any(Date), revokedReason: undefined },
    })
    expect(mock.lock.mock.invocationCallOrder[1])
      .toBeLessThan(mock.claim.mock.invocationCallOrder[0])
    expect(mock.audit).toHaveBeenCalledOnce()
  })

  it('refuses a demoted dispatcher, without editing any assignment', async () => {
    mock.lock.mockImplementation(async (strings: TemplateStringsArray) =>
      strings.join(' ').includes('FROM "User"')
        ? [{ isActive: true, isSuspended: false, isBanned: false }]
        : [{ role: 'WORKER', status: 'ACTIVE' }],
    )
    const result = await revokeAssignment('assignment', 'company', 'owner', 'COMPANY_OWNER')
    expect(result.success).toBe(false)
    expect(result.error).toContain('authorized')
    expect(mock.claim).not.toHaveBeenCalled()
    expect(mock.audit).not.toHaveBeenCalled()
  })

  it('refuses work already started or reassigned after preflight', async () => {
    mock.claim.mockResolvedValue({ count: 0 })
    const result = await revokeAssignment('assignment', 'company', 'owner', 'COMPANY_OWNER')
    expect(result.success).toBe(false)
    expect(result.error).toContain('changed')
    expect(mock.restore).not.toHaveBeenCalled()
    expect(mock.audit).not.toHaveBeenCalled()
  })

  it('refuses the former owner after removal from the company', async () => {
    mock.member.mockResolvedValue(null)
    expect((await revokeAssignment('assignment', 'company', 'owner', 'COMPANY_OWNER')).success).toBe(false)
    expect(mock.lock).not.toHaveBeenCalled()
  })
})
