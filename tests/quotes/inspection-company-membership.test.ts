import { beforeEach, describe, expect, it, vi } from 'vitest'
import { completeInspection, scheduleInspection, transitionInspection } from '@/lib/domain/inspection'

const mock = vi.hoisted(() => ({
  inspection: { id: 'inspection', jobId: 'job', companyId: 'company', taskerId: null,
    status: 'EN_ROUTE', verifiedByCustomer: true },
  assignment: { id: 'assigned' } as null | { id: string },
  member: { id: 'member', role: 'WORKER' } as null | { id: string; role: string },
  findInspection: vi.fn(), updateMany: vi.fn(), update: vi.fn(),
  assignmentFind: vi.fn(), memberFind: vi.fn(), jobFind: vi.fn(),
}))
const client = {
  jobInspection: {
    findUnique: mock.findInspection, updateMany: mock.updateMany, update: mock.update,
  },
  companyJobAssignment: { findFirst: mock.assignmentFind },
  teamMember: { findFirst: mock.memberFind },
  marketplaceJob: { findUnique: mock.jobFind },
} as any

describe('Phase 07 — revoked company staff cannot mutate inspection lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.inspection = { id: 'inspection', jobId: 'job', companyId: 'company',
      taskerId: null, status: 'EN_ROUTE', verifiedByCustomer: true }
    mock.assignment = { id: 'assigned' }
    mock.member = { id: 'member', role: 'WORKER' }
    mock.findInspection.mockImplementation(async () => mock.inspection)
    mock.assignmentFind.mockImplementation(async () => mock.assignment)
    mock.memberFind.mockImplementation(async () => mock.member)
    mock.jobFind.mockResolvedValue({ customerId: 'customer' })
    mock.updateMany.mockResolvedValue({ count: 1 })
    mock.update.mockResolvedValue({ id: 'inspection' })
  })

  it('accepts a valid assigned active worker arriving on site', async () => {
    expect((await transitionInspection(client, {
      inspectionId: 'inspection', userId: 'worker', toStatus: 'ARRIVED',
    })).success).toBe(true)
    expect(mock.memberFind).toHaveBeenCalledWith({
      where: { companyId: 'company', userId: 'worker', status: 'ACTIVE' },
      select: { id: true },
    })
    expect(mock.updateMany).toHaveBeenCalledTimes(1)
  })

  it('rejects an offboarded worker despite a surviving accepted assignment', async () => {
    mock.member = null
    const result = await transitionInspection(client, {
      inspectionId: 'inspection', userId: 'worker', toStatus: 'ARRIVED',
    })
    expect(result).toMatchObject({ success: false, error: 'Not the assigned provider' })
    expect(mock.updateMany).not.toHaveBeenCalled()
  })

  it('rejects workers who are active members but not assigned to this inspection', async () => {
    mock.assignment = null
    expect((await transitionInspection(client, {
      inspectionId: 'inspection', userId: 'worker', toStatus: 'ARRIVED',
    })).success).toBe(false)
    expect(mock.memberFind).not.toHaveBeenCalled()
    expect(mock.updateMany).not.toHaveBeenCalled()
  })

  it('requires current active membership to complete a company inspection', async () => {
    mock.inspection.status = 'IN_PROGRESS'
    mock.member = null
    const result = await completeInspection(client, {
      inspectionId: 'inspection', providerId: 'worker',
      diagnosisSummary: 'Diagnosis', scopeSummary: 'Scope',
    })
    expect(result).toMatchObject({ success: false, error: 'Not the assigned provider' })
    expect(mock.update).not.toHaveBeenCalled()
  })

  it('still permits an accepted active worker to complete inspection', async () => {
    mock.inspection.status = 'IN_PROGRESS'
    expect((await completeInspection(client, {
      inspectionId: 'inspection', providerId: 'worker',
      diagnosisSummary: 'Diagnosis', scopeSummary: 'Scope',
    })).success).toBe(true)
    expect(mock.update).toHaveBeenCalledTimes(1)
  })

  it('rejects revoked staff trying to schedule a company inspection', async () => {
    mock.inspection.status = 'REQUESTED'
    mock.member = null
    const result = await scheduleInspection(client, {
      inspectionId: 'inspection', userId: 'worker',
      scheduledAt: new Date('2030-01-01T09:00:00Z'),
    })
    expect(result.success).toBe(false)
    expect(mock.update).not.toHaveBeenCalled()
  })

  it('continues to allow active authorized management to schedule', async () => {
    mock.inspection.status = 'REQUESTED'
    mock.assignment = null
    mock.member = { id: 'member', role: 'DISPATCHER' }
    expect((await scheduleInspection(client, {
      inspectionId: 'inspection', userId: 'dispatcher',
      scheduledAt: new Date('2030-01-01T09:00:00Z'),
    })).success).toBe(true)
    expect(mock.update).toHaveBeenCalledTimes(1)
  })

  it('does not let an unassigned active WORKER dispute an inspection', async () => {
    mock.inspection.status = 'IN_PROGRESS'
    mock.assignment = null
    const result = await transitionInspection(client, {
      inspectionId: 'inspection', userId: 'worker', toStatus: 'DISPUTED',
    })
    expect(result).toMatchObject({ success: false, error: 'Not authorized for this inspection' })
    expect(mock.updateMany).not.toHaveBeenCalled()
  })

  it('allows an active company manager to dispute an inspection', async () => {
    mock.inspection.status = 'IN_PROGRESS'
    mock.assignment = null
    mock.member = { id: 'member', role: 'MANAGER' }
    expect((await transitionInspection(client, {
      inspectionId: 'inspection', userId: 'manager', toStatus: 'DISPUTED',
    })).success).toBe(true)
  })

  it('allows active assigned WORKER to dispute their inspection', async () => {
    mock.inspection.status = 'IN_PROGRESS'
    expect((await transitionInspection(client, {
      inspectionId: 'inspection', userId: 'worker', toStatus: 'DISPUTED',
    })).success).toBe(true)
  })

  it('rejects offboarded management trying to dispute an inspection', async () => {
    mock.inspection.status = 'IN_PROGRESS'
    mock.assignment = null
    mock.member = null
    expect((await transitionInspection(client, {
      inspectionId: 'inspection', userId: 'old-manager', toStatus: 'DISPUTED',
    })).success).toBe(false)
    expect(mock.updateMany).not.toHaveBeenCalled()
  })

  it('retains customer cancellation independent of company membership', async () => {
    mock.member = null
    mock.inspection.status = 'SCHEDULED'
    expect((await transitionInspection(client, {
      inspectionId: 'inspection', userId: 'customer', toStatus: 'CANCELLED',
    })).success).toBe(true)
  })
})
