import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({
  userId: 'worker',
  membership: null as null | { role: string },
  assignmentFindUnique: vi.fn(),
  membershipFindFirst: vi.fn(),
}))

vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => ({ id: mock.userId, isActive: true }),
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    companyJobAssignment: { findUnique: mock.assignmentFindUnique },
    teamMember: { findFirst: mock.membershipFindFirst },
  },
}))

const assignment = {
  id: 'assignment',
  jobId: 'job',
  companyId: 'company',
  workerUserId: 'worker',
  assignedBy: 'owner',
  status: 'ASSIGNED',
  assignedAt: new Date('2026-01-01T12:00:00.000Z'),
  acceptedAt: null,
  startedAt: null,
  completedAt: null,
  rejectedAt: null,
  revokedAt: null,
  revokedReason: null,
  rejectReason: null,
  job: { id: 'job', title: 'Private customer job', status: 'QUOTE_ACCEPTED', createdAt: new Date('2026-01-01T11:00:00.000Z') },
  worker: { id: 'worker', name: 'Worker', email: 'worker@test.local' },
  company: { id: 'company', companyName: 'Company A', userId: 'owner' },
}

async function readAssignment() {
  const { GET } = await import('@/app/api/mobile/company/assignments/[id]/route')
  return GET(new NextRequest('http://localhost/api/mobile/company/assignments/assignment'), {
    params: Promise.resolve({ id: 'assignment' }),
  })
}

describe('Phase 04 — company assignment detail requires active membership', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.userId = 'worker'
    mock.membership = null
    mock.assignmentFindUnique.mockResolvedValue(assignment)
    mock.membershipFindFirst.mockImplementation(async () => mock.membership)
  })

  it('refuses an assigned worker whose company membership is suspended or removed', async () => {
    const response = await readAssignment()
    expect(response.status).toBe(403)
    const payload = await response.json()
    expect(payload).toEqual({ error: 'Forbidden' })
    expect(mock.membershipFindFirst).toHaveBeenCalledWith({
      where: { companyId: 'company', userId: 'worker', status: 'ACTIVE' },
      select: { role: true },
    })
  })

  it('refuses the recorded owner when the owner no longer has active membership', async () => {
    mock.userId = 'owner'
    const response = await readAssignment()
    expect(response.status).toBe(403)
    expect((await response.json()).job).toBeUndefined()
  })

  it('allows an actively enrolled assigned worker but no management privileges', async () => {
    mock.membership = { role: 'WORKER' }
    const response = await readAssignment()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.capabilities.isAssignedWorker).toBe(true)
    expect(body.capabilities.canManageAssignment).toBe(false)
  })

  it('allows an active company owner to read and manage the assignment', async () => {
    mock.userId = 'owner'
    mock.membership = { role: 'COMPANY_OWNER' }
    const response = await readAssignment()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.capabilities.isAssignedWorker).toBe(false)
    expect(body.capabilities.canManageAssignment).toBe(true)
  })

  it('allows active manager to view and manage with existing RBAC', async () => {
    mock.userId = 'manager'
    mock.membership = { role: 'MANAGER' }
    const response = await readAssignment()
    expect(response.status).toBe(200)
    expect((await response.json()).capabilities.canManageAssignment).toBe(true)
  })

  it('refuses unrelated active members without workers:read', async () => {
    mock.userId = 'other-worker'
    mock.membership = { role: 'WORKER' }
    const response = await readAssignment()
    expect(response.status).toBe(403)
  })

  it('refuses nonexistent assignment before any membership check', async () => {
    mock.assignmentFindUnique.mockResolvedValue(null)
    const response = await readAssignment()
    expect(response.status).toBe(404)
    expect(mock.membershipFindFirst).not.toHaveBeenCalled()
  })
})
