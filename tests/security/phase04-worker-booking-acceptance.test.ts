import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workerAcceptAssignment } from '@/lib/domain/company-job-assignment'

const mock = vi.hoisted(() => ({
  assignment: vi.fn(),
  claim: vi.fn(),
  eligible: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    companyJobAssignment: {
      findUnique: mock.assignment,
      updateMany: mock.claim,
    },
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
    mock.eligible.mockResolvedValue({ eligible: true, reasons: [] })
    mock.claim.mockResolvedValue({ count: 1 })
  })

  it('atomically requires quote-accepted job state and unchanged assigned worker', async () => {
    expect(await workerAcceptAssignment('a', 'w')).toEqual({ success: true, assignmentId: 'a' })
    expect(mock.claim).toHaveBeenCalledWith({
      where: {
        id: 'a', workerUserId: 'w', status: 'ASSIGNED',
        job: { status: 'QUOTE_ACCEPTED', targetTaskerId: 'w' },
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
