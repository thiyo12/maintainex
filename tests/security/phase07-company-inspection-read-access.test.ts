import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mock = vi.hoisted(() => ({
  userId: 'customer',
  suspended: false,
  access: { jobId: 'job', taskerId: null as string | null, companyId: 'company' as string | null, job: { customerId: 'customer' } } as null | { jobId: string; taskerId: string | null; companyId: string | null; job: { customerId: string } },
  managers: [] as string[],
  assignedCompany: null as string | null,
  find: vi.fn(), readable: vi.fn(), assigned: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: { jobInspection: { findUnique: mock.find } } }))
vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => mock.userId ? { id: mock.userId } : null,
  assertNotSuspended: () => mock.suspended
    ? NextResponse.json({ error: 'Suspended' }, { status: 403 }) : null,
}))
vi.mock('@/lib/phase6/company-job-read-access', () => ({
  getReadableCompanyIds: mock.readable,
  getActiveAssignedCompanyId: mock.assigned,
}))
vi.mock('@/lib/domain/inspection', () => ({
  transitionInspection: vi.fn(), completeInspection: vi.fn(),
  scheduleInspection: vi.fn(), verifyInspectionArrival: vi.fn(),
}))
vi.mock('@/lib/notifications', () => ({
  notifyInspectionArrived: vi.fn(), notifyInspectionCompleted: vi.fn(),
}))

async function get(jobId = 'job') {
  const { GET } = await import('@/app/api/mobile/v2/jobs/[id]/inspection/[inspectionId]/route')
  return GET(
    new NextRequest('http://localhost/api/mobile/v2/jobs/' + jobId + '/inspection/inspection'),
    { params: Promise.resolve({ id: jobId, inspectionId: 'inspection' }) },
  )
}
function noEvidenceRead() {
  expect(mock.find).toHaveBeenCalledTimes(1)
  expect(mock.find).toHaveBeenCalledWith({
    where: { id: 'inspection' },
    select: {
      jobId: true, taskerId: true, companyId: true,
      job: { select: { customerId: true } },
    },
  })
}
describe('Phase 07 — inspection details are private to the job participants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.userId = 'customer'
    mock.suspended = false
    mock.access = { jobId: 'job', taskerId: null, companyId: 'company', job: { customerId: 'customer' } }
    mock.managers = []
    mock.assignedCompany = null
    mock.readable.mockImplementation(async () => mock.managers)
    mock.assigned.mockImplementation(async () => mock.assignedCompany)
    mock.find.mockImplementation(async (args) => args.select ? mock.access
      : mock.access ? { ...mock.access, id: 'inspection', evidence: [{ id: 'secret-evidence' }] } : null)
  })

  it('customer reads own evidence', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ inspection: { evidence: [{ id: 'secret-evidence' }] } })
    expect(mock.find).toHaveBeenCalledTimes(2)
  })
  it('actual individual provider can read inspection', async () => {
    mock.userId = 'provider'
    mock.access = { jobId: 'job', taskerId: 'provider', companyId: null, job: { customerId: 'customer' } }
    expect((await get()).status).toBe(200)
    expect(mock.readable).not.toHaveBeenCalled()
  })
  it('unrelated individual is forbidden before evidence query', async () => {
    mock.userId = 'stranger'
    mock.access = { jobId: 'job', taskerId: 'provider', companyId: null, job: { customerId: 'customer' } }
    expect((await get()).status).toBe(403)
    noEvidenceRead()
  })
  it('unassigned worker cannot use broad jobs:read to view evidence', async () => {
    mock.userId = 'worker'
    expect((await get()).status).toBe(403)
    expect(mock.readable).toHaveBeenCalledWith('worker')
    expect(mock.assigned).toHaveBeenCalledWith('job', 'worker')
    noEvidenceRead()
  })
  it('active assigned worker can read job inspection', async () => {
    mock.userId = 'worker'
    mock.assignedCompany = 'company'
    expect((await get()).status).toBe(200)
    expect(mock.find).toHaveBeenCalledTimes(2)
  })
  it('revoked worker assignment or inactive membership denies access', async () => {
    mock.userId = 'worker'
    mock.assignedCompany = null
    expect((await get()).status).toBe(403)
    noEvidenceRead()
  })
  it('assignment for another company cannot read accepted company inspection', async () => {
    mock.userId = 'worker'
    mock.assignedCompany = 'other'
    expect((await get()).status).toBe(403)
    noEvidenceRead()
  })
  it('active authorized manager can read without worker assignment', async () => {
    mock.userId = 'manager'
    mock.managers = ['company']
    expect((await get()).status).toBe(200)
    expect(mock.assigned).not.toHaveBeenCalled()
  })
  it('manager of another company is denied', async () => {
    mock.userId = 'manager'
    mock.managers = ['different-company']
    expect((await get()).status).toBe(403)
    noEvidenceRead()
  })
  it('suspended user is denied before inspection lookup', async () => {
    mock.suspended = true
    expect((await get()).status).toBe(403)
    expect(mock.find).not.toHaveBeenCalled()
  })
  it('unauthenticated user is denied before inspection lookup', async () => {
    mock.userId = ''
    expect((await get()).status).toBe(401)
    expect(mock.find).not.toHaveBeenCalled()
  })
  it('inspection from another job fails closed without reading evidence', async () => {
    mock.access = { jobId: 'other', taskerId: null, companyId: 'company', job: { customerId: 'customer' } }
    expect((await get()).status).toBe(404)
    noEvidenceRead()
  })
  it('missing inspection fails closed without reading evidence', async () => {
    mock.access = null
    expect((await get()).status).toBe(404)
    noEvidenceRead()
  })
})
