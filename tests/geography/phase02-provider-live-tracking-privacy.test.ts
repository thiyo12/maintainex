import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mock = vi.hoisted(() => ({
  user: { id: 'customer', role: 'CUSTOMER' } as { id: string; role: string } | null,
  suspended: false,
  job: { id: 'job', customerId: 'customer', status: 'IN_PROGRESS' },
  quote: { providerId: 'provider', providerType: 'INDIVIDUAL' },
  assignment: { workerUserId: 'worker' } as { workerUserId: string } | null,
  member: { id: 'active-member' } as { id: string } | null,
  manager: null as { id: string } | null,
  workspace: { progressStatus: 'IN_PROGRESS' },
  escrow: { id: 'protected-escrow' } as { id: string } | null,
  gps: { latitude: 49.2827, longitude: -123.1207, locationUpdatedAt: new Date('2030-01-01T10:00:00Z') },
  jobFind: vi.fn(), quoteFind: vi.fn(), assignmentFind: vi.fn(), memberFind: vi.fn(),
  workspaceFind: vi.fn(), escrowFind: vi.fn(), gpsFind: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  marketplaceJob: { findUnique: mock.jobFind },
  jobQuote: { findFirst: mock.quoteFind },
  companyJobAssignment: { findFirst: mock.assignmentFind },
  teamMember: { findFirst: mock.memberFind },
  jobWorkspace: { findUnique: mock.workspaceFind },
  jobEscrow: { findFirst: mock.escrowFind },
  taskerProfile: { findUnique: mock.gpsFind },
} }))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: async () => mock.user,
  assertNotSuspended: () => mock.suspended
    ? NextResponse.json({ error: 'Account suspended' }, { status: 403 }) : null,
}))

async function tracking() {
  const { GET } = await import('@/app/api/mobile/taskers/[id]/location/route')
  const response = await GET(new NextRequest('http://localhost/api/mobile/taskers/job/location'), {
    params: Promise.resolve({ id: 'job' }),
  })
  return { response, body: await response.json() }
}

describe('Phase 02 — job-scoped provider GPS tracking is private and time-bound to the job lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.user = { id: 'customer', role: 'CUSTOMER' }
    mock.suspended = false
    mock.job = { id: 'job', customerId: 'customer', status: 'IN_PROGRESS' }
    mock.quote = { providerId: 'provider', providerType: 'INDIVIDUAL' }
    mock.assignment = { workerUserId: 'worker' }
    mock.member = { id: 'active-member' }
    mock.manager = null
    mock.workspace = { progressStatus: 'IN_PROGRESS' }
    mock.escrow = { id: 'protected-escrow' }
    mock.gps = { latitude: 49.2827, longitude: -123.1207, locationUpdatedAt: new Date('2030-01-01T10:00:00Z') }
    mock.jobFind.mockImplementation(async () => mock.job)
    mock.quoteFind.mockImplementation(async () => mock.quote)
    mock.assignmentFind.mockImplementation(async () => mock.assignment)
    mock.memberFind.mockImplementation(async ({ where }) =>
      'role' in where ? mock.manager : mock.member)
    mock.workspaceFind.mockImplementation(async () => mock.workspace)
    mock.escrowFind.mockImplementation(async () => mock.escrow)
    mock.gpsFind.mockImplementation(async () => mock.gps)
  })

  async function hidden() {
    const { response, body } = await tracking()
    expect(response.status).toBe(200)
    expect(body).toEqual({ sharing: false, location: null })
    expect(mock.gpsFind).not.toHaveBeenCalled()
  }

  it('shares GPS with the customer for an active paid individual booking', async () => {
    const { response, body } = await tracking()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ sharing: true, location: { providerId: 'provider', latitude: 49.2827 } })
  })

  it.each(['COMPLETED', 'CANCELLED', 'DISPUTED', 'OPEN', 'QUOTE_REQUESTED'])(
    'stops precise tracking for job status %s despite an active-looking workspace', async status => {
      mock.job.status = status
      await hidden()
    },
  )

  it('returns no GPS when escrow is not protected', async () => {
    mock.escrow = null
    await hidden()
  })
  it('returns no GPS for a paused workspace', async () => {
    mock.workspace.progressStatus = 'WAITING_CUSTOMER'
    await hidden()
  })
  it('supports accepted but not yet started paid bookings', async () => {
    mock.job.status = 'QUOTE_ACCEPTED'
    mock.workspace.progressStatus = 'ACCEPTED'
    expect((await tracking()).body.sharing).toBe(true)
  })
  it('does not return GPS to an unrelated authenticated account', async () => {
    mock.user = { id: 'stranger', role: 'CUSTOMER' }
    const { response } = await tracking()
    expect(response.status).toBe(403)
    expect(mock.gpsFind).not.toHaveBeenCalled()
  })
  it('blocks suspended users before loading job or GPS data', async () => {
    mock.suspended = true
    const { response } = await tracking()
    expect(response.status).toBe(403)
    expect(mock.jobFind).not.toHaveBeenCalled()
    expect(mock.gpsFind).not.toHaveBeenCalled()
  })
  it('requires authentication', async () => {
    mock.user = null
    expect((await tracking()).response.status).toBe(401)
    expect(mock.jobFind).not.toHaveBeenCalled()
  })
  it('shares GPS of an active accepted company worker with the job customer', async () => {
    mock.quote.providerType = 'COMPANY'
    mock.quote.providerId = 'company'
    const { body } = await tracking()
    expect(body).toMatchObject({ sharing: true, location: { providerId: 'worker' } })
    expect(mock.memberFind).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ companyId: 'company', userId: 'worker', status: 'ACTIVE' }),
    }))
  })
  it('does not share GPS for a removed company worker', async () => {
    mock.quote.providerType = 'COMPANY'
    mock.quote.providerId = 'company'
    mock.member = null
    await hidden()
  })
  it('does not share GPS for a company assignment not yet accepted', async () => {
    mock.quote.providerType = 'COMPANY'
    mock.quote.providerId = 'company'
    mock.assignment = null
    await hidden()
  })
  it('removed workers cannot read company job tracking themselves', async () => {
    mock.quote.providerType = 'COMPANY'
    mock.quote.providerId = 'company'
    mock.user = { id: 'worker', role: 'TASKER' }
    mock.member = null
    const { response } = await tracking()
    expect(response.status).toBe(403)
    expect(mock.gpsFind).not.toHaveBeenCalled()
  })
  it('keeps active company manager access only for an assigned active worker', async () => {
    mock.quote.providerType = 'COMPANY'
    mock.quote.providerId = 'company'
    mock.user = { id: 'manager', role: 'TASKER' }
    mock.manager = { id: 'manager-membership' }
    const { body } = await tracking()
    expect(body).toMatchObject({ sharing: true, location: { providerId: 'worker' } })
  })
})
