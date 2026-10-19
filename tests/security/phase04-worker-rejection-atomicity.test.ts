import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workerRejectAssignment } from '@/lib/domain/company-job-assignment'

const mock = vi.hoisted(() => ({
  assignment: vi.fn(), claim: vi.fn(), restore: vi.fn(), audit: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    companyJobAssignment: { findUnique: mock.assignment },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      companyJobAssignment: { updateMany: mock.claim },
      marketplaceJob: { updateMany: mock.restore },
    }),
  },
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: mock.audit }))
vi.mock('@/lib/phase6/provider-eligibility', () => ({ checkWorkerEligibility: vi.fn() }))
vi.mock('@/lib/security/events', () => ({ emitSecurityEvent: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ notifyCompanyWorkerAssigned: vi.fn() }))

describe('Phase 04 — worker rejection is atomic with restoring the company job', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.assignment.mockResolvedValue({
      id: 'assignment', companyId: 'company', jobId: 'booking',
      workerUserId: 'worker', status: 'ASSIGNED',
    })
    mock.claim.mockResolvedValue({ count: 1 })
    mock.restore.mockResolvedValue({ count: 1 })
  })

  it('rejects only the still-active worker assignment on its original quote-accepted job', async () => {
    expect(await workerRejectAssignment('assignment', 'worker'))
      .toEqual({ success: true, assignmentId: 'assignment' })
    expect(mock.claim).toHaveBeenCalledWith({
      where: {
        id: 'assignment', companyId: 'company', workerUserId: 'worker',
        status: 'ASSIGNED',
        job: { status: 'QUOTE_ACCEPTED', targetTaskerId: 'worker' },
      },
      data: { status: 'REJECTED', rejectedAt: expect.any(Date), rejectReason: undefined },
    })
    expect(mock.restore).toHaveBeenCalledWith({
      where: { id: 'booking', status: 'QUOTE_ACCEPTED', targetTaskerId: 'worker' },
      data: { targetTaskerId: 'company' },
    })
    expect(mock.audit).toHaveBeenCalledOnce()
  })

  it('returns a stale-state conflict when cancelled or reassigned after preflight', async () => {
    mock.claim.mockResolvedValue({ count: 0 })
    const result = await workerRejectAssignment('assignment', 'worker')
    expect(result).toEqual({ success: false, error: 'Assignment changed before it could be rejected' })
    expect(mock.restore).not.toHaveBeenCalled()
    expect(mock.audit).not.toHaveBeenCalled()
  })

  it('returns a conflict and does not audit if target restoration fails', async () => {
    mock.restore.mockResolvedValue({ count: 0 })
    const result = await workerRejectAssignment('assignment', 'worker')
    expect(result).toEqual({ success: false, error: 'Job target changed before assignment rejection' })
    expect(mock.audit).not.toHaveBeenCalled()
  })

  it('rejects another user without starting a transaction', async () => {
    expect((await workerRejectAssignment('assignment', 'impostor')).success).toBe(false)
    expect(mock.claim).not.toHaveBeenCalled()
  })

  it('rejects a worker whose assignment already started', async () => {
    mock.assignment.mockResolvedValue({
      id: 'assignment', companyId: 'company', jobId: 'booking',
      workerUserId: 'worker', status: 'IN_PROGRESS',
    })
    expect((await workerRejectAssignment('assignment', 'worker')).success).toBe(false)
    expect(mock.claim).not.toHaveBeenCalled()
  })
})
