import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({
  userId: 'worker',
  suspended: false,
  managedCompanies: [] as string[],
  assignedCompany: null as string | null,
  job: { id: 'job', customerId: 'customer', status: 'IN_PROGRESS' },
  quote: { providerId: 'company', providerType: 'COMPANY' },
  membership: { id: 'member' } as null | { id: string },
  assignment: { id: 'assignment' } as null | { id: string },
  findJob: vi.fn(),
  quoteFind: vi.fn(),
  memberFind: vi.fn(),
  assignmentFind: vi.fn(),
  findWorkspace: vi.fn(),
  transition: vi.fn(),
  management: vi.fn(),
  activeAssignment: vi.fn(),
}))

vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: async () => ({ id: mock.userId, role: 'TASKER', isActive: true }),
  assertNotSuspended: () => mock.suspended
    ? new Response(JSON.stringify({ error: 'Suspended' }), { status: 403 }) : null,
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  marketplaceJob: { findUnique: mock.findJob },
  jobQuote: { findFirst: mock.quoteFind },
  teamMember: { findFirst: mock.memberFind },
  companyJobAssignment: { findFirst: mock.assignmentFind },
  jobWorkspace: { findUnique: mock.findWorkspace },
} }))
vi.mock('@/lib/phase6/company-job-read-access', () => ({
  getReadableCompanyIds: mock.management,
  getActiveAssignedCompanyId: mock.activeAssignment,
}))
vi.mock('@/lib/domain/job-lifecycle', () => ({
  transitionJobWorkspace: mock.transition,
}))

const params = { params: Promise.resolve({ id: 'job' }) }
async function patch(progressStatus = 'WAITING_CUSTOMER') {
  const { PATCH } = await import('@/app/api/mobile/v2/jobs/[id]/workspace/route')
  return PATCH(new NextRequest('http://localhost/api/mobile/v2/jobs/job/workspace', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ progressStatus }),
  }), params)
}
async function get() {
  const { GET } = await import('@/app/api/mobile/v2/jobs/[id]/workspace/route')
  return GET(new NextRequest('http://localhost/api/mobile/v2/jobs/job/workspace'), params)
}

describe('Phase 07 — company job workspace writes require accepted worker assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.userId = 'worker'
    mock.suspended = false
    mock.managedCompanies = []
    mock.assignedCompany = null
    mock.management.mockImplementation(async () => mock.managedCompanies)
    mock.activeAssignment.mockImplementation(async () => mock.assignedCompany)
    mock.job = { id: 'job', customerId: 'customer', status: 'IN_PROGRESS' }
    mock.quote = { providerId: 'company', providerType: 'COMPANY' }
    mock.membership = { id: 'member' }
    mock.assignment = { id: 'assignment' }
    mock.findJob.mockImplementation(async () => mock.job)
    mock.quoteFind.mockImplementation(async () => mock.quote)
    mock.memberFind.mockImplementation(async () => mock.membership)
    mock.assignmentFind.mockImplementation(async () => mock.assignment)
    mock.findWorkspace.mockResolvedValue({ id: 'workspace' })
    mock.transition.mockResolvedValue({ progressStatus: 'WAITING_CUSTOMER' })
  })

  it('does not let an unrelated active finance employee pause a company job', async () => {
    mock.userId = 'finance'
    mock.assignment = null
    const response = await patch()
    expect(response.status).toBe(403)
    expect(mock.transition).not.toHaveBeenCalled()
    expect(mock.assignmentFind).toHaveBeenCalledWith({
      where: {
        jobId: 'job', companyId: 'company', workerUserId: 'finance',
        status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
      },
      select: { id: true },
    })
  })

  it('does not let a removed worker with an old assignment pause work', async () => {
    mock.membership = null
    const response = await patch()
    expect(response.status).toBe(403)
    expect(mock.assignmentFind).not.toHaveBeenCalled()
  })

  it('requires an accepted or in-progress worker assignment', async () => {
    mock.assignment = null
    const response = await patch()
    expect(response.status).toBe(403)
    expect(mock.transition).not.toHaveBeenCalled()
  })

  it('lets the genuinely accepted and active worker request a pause', async () => {
    const response = await patch()
    expect(response.status).toBe(200)
    expect(mock.transition).toHaveBeenCalledWith(
      { jobId: 'job', actorId: 'worker', actorType: 'COMPANY' },
      'WAITING_CUSTOMER',
    )
  })

  it('lets an existing team manager read the workspace without letting them write', async () => {
    mock.userId = 'manager'
    mock.assignment = null
    mock.managedCompanies = ['company']
    const read = await get()
    expect(read.status).toBe(200)
    expect(mock.assignmentFind).not.toHaveBeenCalled()
    const changed = await patch()
    expect(changed.status).toBe(403)
  })

  it('retains customer-only resume after waiting for input', async () => {
    mock.userId = 'customer'
    const response = await patch('IN_PROGRESS')
    expect(response.status).toBe(200)
    expect(mock.assignmentFind).not.toHaveBeenCalled()
    expect(mock.transition).toHaveBeenCalledWith(
      { jobId: 'job', actorId: 'customer', actorType: 'CUSTOMER' },
      'IN_PROGRESS',
    )
  })

  it('keeps customers from setting the provider-only wait state', async () => {
    mock.userId = 'customer'
    const response = await patch()
    expect(response.status).toBe(403)
    expect(mock.transition).not.toHaveBeenCalled()
  })

  it('retains individual provider pause without company membership', async () => {
    mock.userId = 'individual'
    mock.quote = { providerId: 'individual', providerType: 'INDIVIDUAL' }
    const response = await patch()
    expect(response.status).toBe(200)
    expect(mock.memberFind).not.toHaveBeenCalled()
    expect(mock.assignmentFind).not.toHaveBeenCalled()
  })

  it('refuses a company action before the job is in progress', async () => {
    mock.job = { id: 'job', customerId: 'customer', status: 'QUOTE_ACCEPTED' }
    const response = await patch()
    expect(response.status).toBe(409)
    expect(mock.assignmentFind).not.toHaveBeenCalled()
  })
  it('blocks unassigned active company workers from reading a private workspace', async () => {
    mock.userId = 'worker'
    mock.assignedCompany = null
    expect((await get()).status).toBe(403)
    expect(mock.management).toHaveBeenCalledWith('worker')
    expect(mock.activeAssignment).toHaveBeenCalledWith('job', 'worker')
    expect(mock.findWorkspace).not.toHaveBeenCalled()
  })

  it('permits a current job worker to read their assigned workspace', async () => {
    mock.userId = 'worker'
    mock.assignedCompany = 'company'
    expect((await get()).status).toBe(200)
    expect(mock.findWorkspace).toHaveBeenCalledTimes(1)
  })

  it('denies a revoked assignment or inactive company membership on workspace GET', async () => {
    mock.userId = 'worker'
    mock.assignedCompany = null
    expect((await get()).status).toBe(403)
    expect(mock.findWorkspace).not.toHaveBeenCalled()
  })

  it('rejects company workers assigned to another company', async () => {
    mock.userId = 'worker'
    mock.assignedCompany = 'other-company'
    expect((await get()).status).toBe(403)
    expect(mock.findWorkspace).not.toHaveBeenCalled()
  })

  it('rejects managers from another company', async () => {
    mock.userId = 'manager'
    mock.managedCompanies = ['other-company']
    expect((await get()).status).toBe(403)
    expect(mock.findWorkspace).not.toHaveBeenCalled()
  })

  it('preserves direct customer access to their workspace', async () => {
    mock.userId = 'customer'
    expect((await get()).status).toBe(200)
    expect(mock.management).not.toHaveBeenCalled()
  })

  it('preserves accepted individual provider workspace access', async () => {
    mock.userId = 'individual'
    mock.quote = { providerId: 'individual', providerType: 'INDIVIDUAL' }
    expect((await get()).status).toBe(200)
    expect(mock.management).not.toHaveBeenCalled()
  })

  it('blocks suspended users from reading any workspace data', async () => {
    mock.suspended = true
    expect((await get()).status).toBe(403)
    expect(mock.findJob).not.toHaveBeenCalled()
    expect(mock.findWorkspace).not.toHaveBeenCalled()
  })

})
