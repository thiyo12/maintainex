import { beforeEach, describe, expect, it, vi } from 'vitest'
import { completeAssignment } from '@/lib/domain/company-job-assignment'

const mock = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    companyJobAssignment: {
      findUnique: mock.findUnique,
      updateMany: mock.updateMany,
    },
  },
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: vi.fn() }))
vi.mock('@/lib/security/events', () => ({ emitSecurityEvent: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ notifyCompanyWorkerAssigned: vi.fn() }))
vi.mock('@/lib/phase6/provider-eligibility', () => ({ checkWorkerEligibility: vi.fn() }))

const current = {
  id: 'assignment',
  companyId: 'company',
  status: 'IN_PROGRESS',
  job: { status: 'COMPLETED' },
}

describe('Phase 04 — company assignment completion is compare-and-set', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.findUnique.mockResolvedValue(current)
    mock.updateMany.mockResolvedValue({ count: 1 })
  })

  it('does not succeed when assignment does not exist', async () => {
    mock.findUnique.mockResolvedValue(null)
    const result = await completeAssignment('assignment', 'company')
    expect(result.success).toBe(false)
    expect(mock.updateMany).not.toHaveBeenCalled()
  })

  it('does not complete assignments belonging to another company', async () => {
    const result = await completeAssignment('assignment', 'another-company')
    expect(result.success).toBe(false)
    expect(mock.updateMany).not.toHaveBeenCalled()
  })

  it('does not complete before the customer-approved job is completed', async () => {
    mock.findUnique.mockResolvedValue({ ...current, job: { status: 'IN_PROGRESS' } })
    const result = await completeAssignment('assignment', 'company')
    expect(result.success).toBe(false)
    expect(mock.updateMany).not.toHaveBeenCalled()
  })

  it('does not complete an ASSIGNED or ACCEPTED worker', async () => {
    for (const status of ['ASSIGNED', 'ACCEPTED']) {
      mock.findUnique.mockResolvedValue({ ...current, status })
      const result = await completeAssignment('assignment', 'company')
      expect(result.success).toBe(false)
    }
    expect(mock.updateMany).not.toHaveBeenCalled()
  })

  it('rejects a lost completion race when the update affects zero rows', async () => {
    mock.updateMany.mockResolvedValue({ count: 0 })
    const result = await completeAssignment('assignment', 'company')
    expect(result).toEqual({
      success: false,
      error: 'Assignment state changed before completion',
    })
    expect(mock.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'assignment', companyId: 'company', status: 'IN_PROGRESS',
        job: { status: 'COMPLETED' },
      },
      data: { status: 'COMPLETED', completedAt: expect.any(Date) },
    })
  })

  it('guards against the parent job status reverting before completion is written', async () => {
    // The database conditional update returns zero after concurrent status change.
    mock.updateMany.mockResolvedValue({ count: 0 })
    expect((await completeAssignment('assignment', 'company')).success).toBe(false)
    expect(mock.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ job: { status: 'COMPLETED' } }),
    }))
  })

  it('succeeds only after one row is actually marked completed', async () => {
    const result = await completeAssignment('assignment', 'company')
    expect(result).toEqual({ success: true, assignmentId: 'assignment' })
    expect(mock.updateMany).toHaveBeenCalledOnce()
  })

  it('keeps already-completed assignments idempotent without writing', async () => {
    mock.findUnique.mockResolvedValue({ ...current, status: 'COMPLETED' })
    const result = await completeAssignment('assignment', 'company')
    expect(result).toEqual({ success: true, assignmentId: 'assignment' })
    expect(mock.updateMany).not.toHaveBeenCalled()
  })
})
