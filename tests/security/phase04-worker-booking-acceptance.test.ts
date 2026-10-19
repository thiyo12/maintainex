import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workerAcceptAssignment } from '@/lib/domain/company-job-assignment'

const mock = vi.hoisted(() => ({
  assignment: vi.fn(),
  claim: vi.fn(),
  eligible: vi.fn(),
  lock: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    companyJobAssignment: {
      findUnique: mock.assignment,
      updateMany: mock.claim,
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      $queryRaw: mock.lock,
      companyJobAssignment: { updateMany: mock.claim },
    }),
  },
}))
vi.mock('@/lib/phase6/provider-eligibility', () => ({
  checkWorkerEligibility: mock.eligible,
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: vi.fn() }))
vi.mock('@/lib/security/events', () => ({ emitSecurityEvent: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ notifyCompanyWorkerAssigned: vi.fn() }))

describe('Phase 04 — worker cannot accept a cancelled or reassigned booking', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.assignment.mockResolvedValue({
      id: 'a', companyId: 'c', jobId: 'j', workerUserId: 'w', status: 'ASSIGNED',
    })
    mock.lock.mockImplementation(async (strings: TemplateStringsArray) =>
      strings.join(' ').includes('FROM "User"')
        ? [{ isActive: true, isSuspended: false, isBanned: false, identityStatus: 'VERIFIED' }]
        : [{ role: 'WORKER', status: 'ACTIVE' }],
    )
    mock.eligible.mockResolvedValue({ eligible: true, reasons: [] })
    mock.claim.mockResolvedValue({ count: 1 })
  })

  it('atomically requires quote-accepted job state and unchanged assigned worker', async () => {
    expect(await workerAcceptAssignment('a', 'w')).toEqual({ success: true, assignmentId: 'a' })
    expect(mock.claim).toHaveBeenCalledWith({
      where: {
        id: 'a', workerUserId: 'w', companyId: 'c', status: 'ASSIGNED',
        job: { status: 'QUOTE_ACCEPTED', targetTaskerId: 'w' },
        worker: {
          isActive: true, isSuspended: false, isBanned: false,
          identityStatus: 'VERIFIED',
        },
      },
      data: { status: 'ACCEPTED', acceptedAt: expect.any(Date) },
    })
  })

  it('fails closed when the parent job or assignee changed since eligibility check', async () => {
    // A real Prisma updateMany returns 0 if the nested job where condition
    // fails: cancellation and reassignment do not allow stale acceptance.
    mock.claim.mockResolvedValue({ count: 0 })
    const result = await workerAcceptAssignment('a', 'w')
    expect(result.success).toBe(false)
    expect(result.error).toContain('changed')
  })

  it('fails closed if worker suspension, ban, inactivity, or identity revocation races acceptance', async () => {
    // A real relational Prisma updateMany returns count 0 when any atomic
    // User condition fails, even when the earlier eligibility check passed.
    mock.claim.mockResolvedValue({ count: 0 })
    const result = await workerAcceptAssignment('a', 'w')
    expect(result).toEqual({
      success: false, error: 'Assignment changed before it could be accepted',
    })
    expect(mock.eligible).toHaveBeenCalledWith('c', 'w', 'j')
    expect(mock.claim).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        worker: {
          isActive: true, isSuspended: false, isBanned: false,
          identityStatus: 'VERIFIED',
        },
      }),
    }))
  })

  it('fails closed when a member is suspended or promoted before commit', async () => {
    mock.lock.mockImplementation(async (strings: TemplateStringsArray) =>
      strings.join(' ').includes('FROM "User"')
        ? [{ isActive: true, isSuspended: false, isBanned: false, identityStatus: 'VERIFIED' }]
        : [{ role: 'MANAGER', status: 'ACTIVE' }],
    )
    expect((await workerAcceptAssignment('a', 'w')).success).toBe(false)
    expect(mock.claim).not.toHaveBeenCalled()
  })

  it('locks the worker account and membership before claiming the assignment', async () => {
    expect((await workerAcceptAssignment('a', 'w')).success).toBe(true)
    expect(mock.lock).toHaveBeenCalledTimes(2)
    expect(mock.lock.mock.invocationCallOrder[1])
      .toBeLessThan(mock.claim.mock.invocationCallOrder[0])
  })

  it('does not allow another worker to accept an assignment', async () => {
    const result = await workerAcceptAssignment('a', 'other')
    expect(result.success).toBe(false)
    expect(mock.claim).not.toHaveBeenCalled()
  })

  it('refuses acceptance if worker eligibility has since expired', async () => {
    mock.eligible.mockResolvedValue({ eligible: false, reasons: ['Account suspended'] })
    const result = await workerAcceptAssignment('a', 'w')
    expect(result.success).toBe(false)
    expect(result.reasons).toContain('Account suspended')
    expect(mock.claim).not.toHaveBeenCalled()
  })

  it('does not allow repeat acceptance of an already accepted worker assignment', async () => {
    mock.assignment.mockResolvedValue({
      id: 'a', companyId: 'c', jobId: 'j', workerUserId: 'w', status: 'ACCEPTED',
    })
    const result = await workerAcceptAssignment('a', 'w')
    expect(result.success).toBe(false)
    expect(mock.claim).not.toHaveBeenCalled()
  })
})
