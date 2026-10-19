import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CrewReadinessError,
  previewCompanyCrewReadiness,
} from '@/lib/domain/company-crew-readiness'

const mocks = vi.hoisted(() => ({
  quote: vi.fn(),
  job: vi.fn(),
  assignment: vi.fn(),
  eligibility: vi.fn(),
  photo: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    jobQuote: { findFirst: mocks.quote },
    marketplaceJob: { findUnique: mocks.job },
    companyJobAssignment: { findFirst: mocks.assignment },
    providerIdentity: { findFirst: mocks.photo },
  },
}))
vi.mock('@/lib/phase6/provider-eligibility', () => ({
  checkCrewCandidateEligibility: mocks.eligibility,
}))

const review = (workerUserIds: string[] = ['worker-a', 'worker-b']) =>
  previewCompanyCrewReadiness({ companyId: 'company', jobId: 'job', workerUserIds })

describe('Phase 04 — company crew readiness is a non-mutating preflight', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.quote.mockResolvedValue({ id: 'accepted-quote' })
    mocks.job.mockResolvedValue({ status: 'QUOTE_ACCEPTED', workersCount: 2 })
    mocks.assignment.mockResolvedValue(null)
    mocks.eligibility.mockResolvedValue({ eligible: true, reasons: [] })
    mocks.photo.mockResolvedValue({ id: 'approved-worker-photo' })
  })

  it('returns a complete, non-dispatchable report for qualified distinct workers', async () => {
    const report = await review()
    expect(report).toEqual({
      previewOnly: true,
      dispatchEnabled: false,
      companyId: 'company',
      jobId: 'job',
      requiredWorkersCount: 2,
      selectedWorkersCount: 2,
      preflightReady: true,
      blockers: [],
      workers: [
        { workerUserId: 'worker-a', eligible: true, reasons: [] },
        { workerUserId: 'worker-b', eligible: true, reasons: [] },
      ],
    })
    expect(mocks.quote).toHaveBeenCalledWith({
      where: {
        jobId: 'job', providerId: 'company',
        providerType: 'COMPANY', status: 'ACCEPTED',
      },
      select: { id: true },
    })
    expect(mocks.eligibility).toHaveBeenCalledWith('company', 'worker-a', 'job')
    expect(mocks.eligibility).toHaveBeenCalledWith('company', 'worker-b', 'job')
  })

  it('requires approved identity photos for every crew candidate regardless of optional job flag', async () => {
    mocks.photo.mockImplementation(async ({ where }: { where: { currentUserId: string } }) =>
      where.currentUserId === 'worker-a' ? { id: 'approved-photo' } : null)
    const report = await review()
    expect(report.preflightReady).toBe(false)
    expect(report.dispatchEnabled).toBe(false)
    expect(report.workers[0].eligible).toBe(true)
    expect(report.workers[1].eligible).toBe(false)
    expect(report.workers[1].reasons).toContain('Crew member verified profile photo not approved')
    expect(mocks.photo).toHaveBeenCalledWith({
      where: {
        currentUserId: 'worker-b',
        identityType: { in: ['TASKER', 'COMPANY_WORKER'] },
        kycStatus: 'VERIFIED',
        verifiedPhotoUrl: { not: null },
      },
      select: { id: true },
    })
  })

  it('marks a partial crew blocked while showing eligible candidate results', async () => {
    const report = await review(['worker-a'])
    expect(report.preflightReady).toBe(false)
    expect(report.blockers).toContain('Select exactly 2 distinct workers for this booking')
    expect(report.workers).toHaveLength(1)
    expect(report.dispatchEnabled).toBe(false)
  })

  it('refuses worker IDs repeated across crew slots before database access', async () => {
    await expect(review(['worker-a', 'worker-a']))
      .rejects.toMatchObject({ status: 400 })
    expect(mocks.quote).not.toHaveBeenCalled()
  })

  it.each([
    { ids: [''], status: 400 },
    { ids: [' worker-a'], status: 400 },
    { ids: Array.from({ length: 13 }, (_, index) => 'worker-' + index), status: 400 },
  ])('bounds malformed or expensive crew candidate lists before querying', async ({ ids, status }) => {
    await expect(review(ids)).rejects.toMatchObject({ status })
    expect(mocks.quote).not.toHaveBeenCalled()
  })

  it('does not reveal unrelated company bookings', async () => {
    mocks.quote.mockResolvedValue(null)
    await expect(review()).rejects.toMatchObject({ status: 404 })
    expect(mocks.job).not.toHaveBeenCalled()
    expect(mocks.eligibility).not.toHaveBeenCalled()
  })

  it('does not preview an individual-only booking', async () => {
    mocks.job.mockResolvedValue({ status: 'QUOTE_ACCEPTED', workersCount: 1 })
    await expect(review()).rejects.toMatchObject({ status: 409 })
    expect(mocks.eligibility).not.toHaveBeenCalled()
  })

  it('rejects cancelled or already-started company bookings', async () => {
    for (const status of ['IN_PROGRESS', 'CANCELLED']) {
      mocks.job.mockResolvedValue({ status, workersCount: 2 })
      await expect(review()).rejects.toMatchObject({ status: 409 })
    }
    expect(mocks.eligibility).not.toHaveBeenCalled()
  })

  it('blocks oversize bookings without evaluating an unbounded workforce', async () => {
    mocks.job.mockResolvedValue({ status: 'QUOTE_ACCEPTED', workersCount: 100 })
    await expect(review()).rejects.toMatchObject({ status: 409 })
    expect(mocks.eligibility).not.toHaveBeenCalled()
  })

  it('blocks even a qualified roster if a legacy assignment is active', async () => {
    mocks.assignment.mockResolvedValue({ id: 'active-legacy-assignment' })
    const report = await review()
    expect(report.preflightReady).toBe(false)
    expect(report.blockers).toContain('Booking already has an active single-worker assignment')
  })

  it('reports all capability and identity failures without granting dispatch', async () => {
    mocks.eligibility.mockImplementation(async (_company: string, workerId: string) =>
      workerId === 'worker-b'
        ? { eligible: false, reasons: ['Worker lacks required capability for this job'] }
        : { eligible: true, reasons: [] })
    const report = await review()
    expect(report.preflightReady).toBe(false)
    expect(report.dispatchEnabled).toBe(false)
    expect(report.workers[1].reasons)
      .toContain('Worker lacks required capability for this job')
  })

  it('never exposes mutation methods or claims a reserved crew', async () => {
    const report = await review()
    expect(report).not.toHaveProperty('assignmentId')
    expect(report).not.toHaveProperty('pin')
    expect(report).not.toHaveProperty('reserved')
    expect(CrewReadinessError).toBeDefined()
  })
})
