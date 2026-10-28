import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mock = vi.hoisted(() => ({
  userId: 'worker',
  suspended: false,
  job: { id: 'job', customerId: 'customer' } as null | { id: string; customerId: string },
  quote: { providerId: 'company', providerType: 'COMPANY' } as null | { providerId: string; providerType: string },
  assignment: { id: 'assignment' } as null | { id: string },
  member: { id: 'membership' } as null | { id: string },
  jobFind: vi.fn(),
  quoteFind: vi.fn(),
  assignmentFind: vi.fn(),
  memberFind: vi.fn(),
  evidenceCreate: vi.fn(),
  inspectionFind: vi.fn(),
}))

vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => ({ id: mock.userId, role: 'TASKER' }),
  assertNotSuspended: () => mock.suspended
    ? NextResponse.json({ error: 'Account suspended' }, { status: 403 })
    : null,
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  marketplaceJob: { findUnique: mock.jobFind },
  jobQuote: { findFirst: mock.quoteFind },
  companyJobAssignment: { findFirst: mock.assignmentFind },
  teamMember: { findFirst: mock.memberFind },
  jobEvidence: { create: mock.evidenceCreate },
  jobInspection: { findUnique: mock.inspectionFind },
} }))

async function upload(body: Record<string, unknown> = {
  evidenceType: 'NOTE', description: 'Site needs additional safety equipment',
}) {
  const { POST } = await import('@/app/api/mobile/v2/jobs/[id]/evidence/route')
  return POST(new NextRequest('http://localhost/api/mobile/v2/jobs/job/evidence', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: 'job' }) })
}

describe('Phase 07 — company evidence requires current active team membership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.userId = 'worker'
    mock.suspended = false
    mock.job = { id: 'job', customerId: 'customer' }
    mock.quote = { providerId: 'company', providerType: 'COMPANY' }
    mock.assignment = { id: 'assignment' }
    mock.member = { id: 'membership' }
    mock.jobFind.mockImplementation(async () => mock.job)
    mock.quoteFind.mockImplementation(async () => mock.quote)
    mock.assignmentFind.mockImplementation(async () => mock.assignment)
    mock.memberFind.mockImplementation(async () => mock.member)
    mock.evidenceCreate.mockResolvedValue({ id: 'evidence' })
    mock.inspectionFind.mockResolvedValue(null)
  })

  it('accepts work evidence for an accepted assigned active company worker', async () => {
    const r = await upload()
    expect(r.status).toBe(201)
    expect(await r.json()).toMatchObject({ success: true, evidenceId: 'evidence' })
    expect(mock.assignmentFind).toHaveBeenCalledWith({
      where: {
        jobId: 'job', companyId: 'company', workerUserId: 'worker',
        status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
      },
      select: { id: true },
    })
    expect(mock.memberFind).toHaveBeenCalledWith({
      where: { companyId: 'company', userId: 'worker', status: 'ACTIVE' },
      select: { id: true },
    })
  })

  it('denies offboarded workers even if an accepted assignment survives', async () => {
    mock.member = null
    expect((await upload()).status).toBe(403)
    expect(mock.evidenceCreate).not.toHaveBeenCalled()
  })

  it('denies active employees who never accepted this job', async () => {
    mock.assignment = null
    expect((await upload()).status).toBe(403)
    expect(mock.memberFind).not.toHaveBeenCalled()
    expect(mock.evidenceCreate).not.toHaveBeenCalled()
  })

  it('blocks an unrelated company manager with no job assignment', async () => {
    mock.userId = 'manager'
    mock.assignment = null
    expect((await upload()).status).toBe(403)
    expect(mock.evidenceCreate).not.toHaveBeenCalled()
  })

  it('keeps individual provider uploads working without company membership', async () => {
    mock.userId = 'tasker'
    mock.quote = { providerId: 'tasker', providerType: 'INDIVIDUAL' }
    expect((await upload()).status).toBe(201)
    expect(mock.assignmentFind).not.toHaveBeenCalled()
    expect(mock.memberFind).not.toHaveBeenCalled()
  })

  it('allows customers to upload job evidence without an accepted provider', async () => {
    mock.userId = 'customer'
    mock.quote = null
    expect((await upload()).status).toBe(201)
    expect(mock.quoteFind).not.toHaveBeenCalled()
  })

  it('denies suspended accounts without querying any private job data', async () => {
    mock.suspended = true
    expect((await upload()).status).toBe(403)
    expect(mock.jobFind).not.toHaveBeenCalled()
  })

  it('denies third-party uploads unrelated to the job', async () => {
    mock.userId = 'outsider'
    mock.quote = { providerId: 'tasker', providerType: 'INDIVIDUAL' }
    expect((await upload()).status).toBe(403)
    expect(mock.evidenceCreate).not.toHaveBeenCalled()
  })

  it('rejects evidence attached to inspections from a different job', async () => {
    mock.inspectionFind.mockResolvedValue({ id: 'inspection', jobId: 'other' })
    expect((await upload({ evidenceType: 'NOTE', description: 'site issue', inspectionId: 'inspection' })).status).toBe(404)
    expect(mock.evidenceCreate).not.toHaveBeenCalled()
  })

  it('does not widen the assignment guard to unaccepted or revoked statuses', async () => {
    await upload()
    expect(mock.assignmentFind).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { in: ['ACCEPTED', 'IN_PROGRESS'] } }),
    }))
  })
})
