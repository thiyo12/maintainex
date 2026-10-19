import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAssignment, reassignWorker } from '@/lib/domain/company-job-assignment'

const db = vi.hoisted(() => ({
  member: vi.fn(), job: vi.fn(), quote: vi.fn(), company: vi.fn(),
  existing: vi.fn(), reusable: vi.fn(), sql: vi.fn(), busy: vi.fn(),
  claim: vi.fn(), revoke: vi.fn(), create: vi.fn(), update: vi.fn(),
  workspace: vi.fn(), eligible: vi.fn(), audit: vi.fn(), notify: vi.fn(),
  invalidateIdentity: vi.fn(), priorArrival: vi.fn(), revokePins: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    teamMember: { findFirst: db.member },
    marketplaceJob: { findUnique: db.job },
    jobQuote: { findFirst: db.quote },
    companyProfile: { findUnique: db.company },
    companyJobAssignment: { findFirst: db.existing, findUnique: db.reusable },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({
      $queryRaw: db.sql,
      marketplaceJob: { updateMany: db.claim },
      companyJobAssignment: {
        findFirst: db.busy, updateMany: db.revoke, create: db.create, update: db.update,
      },
      jobWorkspace: { upsert: db.workspace },
      jobWorkerIdentityCheck: { updateMany: db.invalidateIdentity },
      jobVerificationPin: { findFirst: db.priorArrival, updateMany: db.revokePins },
    }),
  },
}))
vi.mock('@/lib/phase6/provider-eligibility', () => ({
  checkWorkerEligibility: db.eligible,
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: db.audit }))
vi.mock('@/lib/security/events', () => ({ emitSecurityEvent: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ notifyCompanyWorkerAssigned: db.notify }))

const jobSnapshot = {
  id: 'job', title: 'Booked service', status: 'QUOTE_ACCEPTED',
  preferredDate: null, preferredTimeSlot: null,
  workersCount: 1, workerIdentityCheckRequired: false,
}

describe('Phase 04 — final dispatch claim uses unchanged booking requirements', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.member.mockResolvedValue({ role: 'COMPANY_OWNER' })
    db.job.mockResolvedValue({ ...jobSnapshot })
    db.quote.mockResolvedValue({ id: 'accepted-quote' })
    db.company.mockResolvedValue({ userId: 'founder', companyName: 'Provider Co' })
    db.existing.mockResolvedValue(null)
    db.reusable.mockResolvedValue(null)
    db.eligible.mockResolvedValue({ eligible: true, reasons: [] })
    db.busy.mockResolvedValue(null)
    db.claim.mockResolvedValue({ count: 1 })
    db.priorArrival.mockResolvedValue(null)
    db.invalidateIdentity.mockResolvedValue({ count: 0 })
    db.revokePins.mockResolvedValue({ count: 0 })
    db.revoke.mockResolvedValue({ count: 1 })
    db.create.mockResolvedValue({ id: 'assignment' })
    db.update.mockResolvedValue({ id: 'assignment' })
    db.sql.mockImplementation(async (strings: TemplateStringsArray, ...args: unknown[]) => {
      const sql = strings.join(' ')
      if (sql.includes('FROM "User"')) {
        return [{ isActive: true, isSuspended: false, isBanned: false, identityStatus: 'VERIFIED' }]
      }
      if (sql.includes('FROM "TeamMember"')) {
        return [{ role: args[1] === 'owner' ? 'COMPANY_OWNER' : 'WORKER', status: 'ACTIVE' }]
      }
      return []
    })
  })

  it('claims a one-worker job only if schedule and identity requirement have not changed', async () => {
    expect((await createAssignment({
      companyId: 'company', jobId: 'job', workerUserId: 'worker',
      assignedByUserId: 'owner', actorRole: 'COMPANY_OWNER',
    })).success).toBe(true)
    expect(db.claim).toHaveBeenCalledWith({
      where: {
        id: 'job', status: 'QUOTE_ACCEPTED', workersCount: 1,
        workerIdentityCheckRequired: false, preferredDate: null, preferredTimeSlot: null,
        OR: [
          { targetTaskerId: null },
          { targetTaskerId: 'company' },
          { targetTaskerId: 'founder' },
        ],
      },
      data: { targetTaskerId: 'worker' },
    })
    expect(db.create).toHaveBeenCalledOnce()
    expect(db.invalidateIdentity).toHaveBeenCalledWith({
      where: { jobId: 'job', status: 'MATCHED' },
      data: { status: 'PENDING', confirmedAt: null },
    })
    expect(db.revokePins).toHaveBeenCalledWith({
      where: { jobId: 'job', status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: expect.any(Date) },
    })
  })

  it('returns a conflict if a crew or photo requirement was changed since preflight', async () => {
    db.claim.mockResolvedValue({ count: 0 })
    const result = await createAssignment({
      companyId: 'company', jobId: 'job', workerUserId: 'worker',
      assignedByUserId: 'owner', actorRole: 'COMPANY_OWNER',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('concurrently')
    expect(db.workspace).not.toHaveBeenCalled()
    expect(db.create).not.toHaveBeenCalled()
  })

  it('refuses a first assignment if the previous worker already proved arrival', async () => {
    db.priorArrival.mockResolvedValue({ id: 'previous-arrival' })
    const result = await createAssignment({
      companyId: 'company', jobId: 'job', workerUserId: 'worker',
      assignedByUserId: 'owner', actorRole: 'COMPANY_OWNER',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('arrival PIN')
    expect(db.invalidateIdentity).not.toHaveBeenCalled()
    expect(db.workspace).not.toHaveBeenCalled()
    expect(db.create).not.toHaveBeenCalled()
  })

  it('reassignment preserves the same crew, photo and schedule guard', async () => {
    db.existing.mockResolvedValue({
      id: 'old-assignment', companyId: 'company', jobId: 'job',
      workerUserId: 'old-worker', status: 'ACCEPTED',
    })
    expect((await reassignWorker('company', 'job', 'worker', 'owner', 'COMPANY_OWNER')).success)
      .toBe(true)
    expect(db.claim).toHaveBeenCalledWith({
      where: {
        id: 'job', status: 'QUOTE_ACCEPTED', targetTaskerId: 'old-worker',
        workersCount: 1, workerIdentityCheckRequired: false,
        preferredDate: null, preferredTimeSlot: null,
      },
      data: { targetTaskerId: 'worker' },
    })
    expect(db.revoke).toHaveBeenCalledOnce()
    expect(db.invalidateIdentity).toHaveBeenCalledWith({
      where: { jobId: 'job', status: 'MATCHED' },
      data: { status: 'PENDING', confirmedAt: null },
    })
    expect(db.revokePins).toHaveBeenCalledWith({
      where: { jobId: 'job', status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: expect.any(Date) },
    })
  })

  it('refuses reassignment if the prior worker has already verified arrival', async () => {
    db.existing.mockResolvedValue({
      id: 'old-assignment', companyId: 'company', jobId: 'job',
      workerUserId: 'old-worker', status: 'ACCEPTED',
    })
    db.priorArrival.mockResolvedValue({ id: 'verified-arrival' })
    const result = await reassignWorker('company', 'job', 'worker', 'owner', 'COMPANY_OWNER')
    expect(result.success).toBe(false)
    expect(result.error).toContain('arrival PIN')
    expect(db.invalidateIdentity).not.toHaveBeenCalled()
    expect(db.revoke).not.toHaveBeenCalled()
    expect(db.audit).not.toHaveBeenCalled()
  })

  it('refuses to revoke the previous worker when the booking changed', async () => {
    db.existing.mockResolvedValue({
      id: 'old-assignment', companyId: 'company', jobId: 'job',
      workerUserId: 'old-worker', status: 'ACCEPTED',
    })
    db.claim.mockResolvedValue({ count: 0 })
    const result = await reassignWorker('company', 'job', 'worker', 'owner', 'COMPANY_OWNER')
    expect(result.success).toBe(false)
    expect(result.error).toContain('reassignment')
    expect(db.revoke).not.toHaveBeenCalled()
    expect(db.create).not.toHaveBeenCalled()
  })
})
