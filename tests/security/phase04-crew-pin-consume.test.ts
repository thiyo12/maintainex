import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deriveCrewPinDigest } from '@/lib/domain/company-crew-pin-epoch'
import { consumeStagedCrewMemberPinInsideTransaction } from '@/lib/domain/company-crew-pin-consume'

const m = vi.hoisted(() => ({
  key: vi.fn(), sql: vi.fn(), slots: vi.fn(),
  mismatch: vi.fn(), pinState: vi.fn(), schedule: vi.fn(),
  eligibility: vi.fn(), photo: vi.fn(), match: vi.fn(), update: vi.fn(),
}))
vi.mock('@/lib/domain/company-crew-commit-gate', () => ({
  CrewCommitGateError: class CrewCommitGateError extends Error {
    constructor(message: string, public readonly status = 409) { super(message) }
  },
}))
vi.mock('@/lib/domain/company-job-assignment', () => ({
  lockAndAssertWorkerScheduleAvailable: m.schedule,
}))
vi.mock('@/lib/phase6/provider-eligibility', () => ({
  checkCrewCandidateEligibility: m.eligibility,
}))
const secret = Buffer.alloc(32, 0x3f)
const t = new Date(Date.now() - 60000)
const slots = [
  { id: 'slot-a', workerUserId: 'worker-a', jobId: 'job', companyId: 'company',
    status: 'CREW_ACCEPTED', crewSlot: 1, crewRole: 'LEAD',
    acceptedAt: t, crewIdentityConfirmedAt: new Date(t.getTime() + 1000),
    crewArrivedAt: null, startedAt: null },
  { id: 'slot-b', workerUserId: 'worker-b', jobId: 'job', companyId: 'company',
    status: 'CREW_ACCEPTED', crewSlot: 2, crewRole: 'MEMBER',
    acceptedAt: t, crewIdentityConfirmedAt: new Date(t.getTime() + 1000),
    crewArrivedAt: null, startedAt: null },
]
const scope = {
  crewDispatchId: 'crew', jobId: 'job', crewVersion: 4,
  assignmentId: 'slot-a', workerUserId: 'worker-a', purpose: 'ARRIVAL' as const,
}
const challenge = () => ({
  id: 'challenge', crewDispatchId: 'crew', jobId: 'job',
  crewVersion: 4, assignmentId: 'slot-a', issuedByCustomerUserId: 'customer',
  purpose: 'ARRIVAL', pinDigest: deriveCrewPinDigest('123456', scope, secret),
  expiresAt: new Date(Date.now() + 300000), failedAttempts: 0,
  lockedUntil: null, consumedAt: null, revokedAt: null,
})
const tx = {
  companyCrewDispatch: { findUnique: m.key },
  companyJobAssignment: { findMany: m.slots },
  jobWorkerIdentityCheck: { findFirst: m.mismatch, findUnique: m.match },
  jobVerificationPin: { findFirst: m.pinState },
  providerIdentity: { findFirst: m.photo },
  companyCrewPinChallenge: { updateMany: m.update },
  $queryRaw: m.sql,
}
const request = {
  crewDispatchId: 'crew', expectedVersion: 4,
  authenticatedWorkerUserId: 'worker-a',
  purpose: 'ARRIVAL' as const, pin: '123456', signingKey: secret,
}
const verify = (overrides: Record<string, unknown> = {}) =>
  consumeStagedCrewMemberPinInsideTransaction(tx as any, { ...request, ...overrides })

describe('Phase04 internal PIN consumption is exact-member scoped and never authorizes work', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.key.mockResolvedValue({ companyId: 'company', jobId: 'job' })
    m.sql.mockResolvedValueOnce([{ id: 'quote' }])
      .mockResolvedValueOnce([{ id: 'job', status: 'QUOTE_ACCEPTED',
        workersCount: 2, customerId: 'customer', preferredDate: null,
        preferredTimeSlot: null }])
      .mockResolvedValueOnce([{ id: 'crew', companyId: 'company', jobId: 'job',
        version: 4, requiredWorkersCount: 2, status: 'FORMING',
        leadWorkerUserId: 'worker-a' }])
      .mockResolvedValueOnce([challenge()])
    m.slots.mockResolvedValue(slots)
    m.mismatch.mockResolvedValue(null)
    m.pinState.mockResolvedValue(null)
    m.eligibility.mockResolvedValue({ eligible: true })
    m.photo.mockImplementation(async (args: any) =>
      ({ id: 'photo-' + args.where.currentUserId, verifiedPhotoUrl: '/verified' }))
    m.match.mockImplementation(async (args: any) =>
      ({ status: 'MATCHED', assignedWorkerUserId:
        args.where.jobId_providerIdentityId.providerIdentityId.slice(6),
        photoSnapshotUrl: '/verified',
        confirmedAt: new Date(t.getTime() + 1000) }))
    m.update.mockResolvedValue({ count: 1 })
  })

  it('consumes only the bound active challenge once, with no arrival/job/workspace write', async () => {
    expect(await verify()).toEqual({
      pinVerified: true, attemptsRemaining: 0, arrivalEnabled: false, workStartEnabled: false,
    })
    expect(m.update).toHaveBeenCalledWith({
      where: { id: 'challenge', consumedAt: null, revokedAt: null, failedAttempts: 0 },
      data: { consumedAt: expect.any(Date) },
    })
    expect(m.schedule).toHaveBeenCalledTimes(2)
    expect(m.eligibility).toHaveBeenCalledTimes(2)
    expect(m.photo).toHaveBeenCalledTimes(2)
    expect(tx).not.toHaveProperty('marketplaceJob')
    expect(tx).not.toHaveProperty('jobWorkspace')
  })

  it('persists failed PIN attempts without throwing and locks on attempt five', async () => {
    expect(await verify({ pin: '123457' })).toEqual({
      pinVerified: false, attemptsRemaining: 4, arrivalEnabled: false,
      workStartEnabled: false,
    })
    expect(m.update).toHaveBeenCalledWith({
      where: { id: 'challenge', consumedAt: null, revokedAt: null, failedAttempts: 0 },
      data: { failedAttempts: 1, lockedUntil: null },
    })
    m.update.mockClear()
    m.sql.mockReset().mockResolvedValueOnce([{ id: 'quote' }])
      .mockResolvedValueOnce([{ id: 'job', status: 'QUOTE_ACCEPTED',
        workersCount: 2, customerId: 'customer', preferredDate: null,
        preferredTimeSlot: null }])
      .mockResolvedValueOnce([{ id: 'crew', companyId: 'company', jobId: 'job',
        version: 4, requiredWorkersCount: 2, status: 'FORMING',
        leadWorkerUserId: 'worker-a' }])
      .mockResolvedValueOnce([{ ...challenge(), failedAttempts: 4 }])
    expect((await verify({ pin: '123457' })).attemptsRemaining).toBe(0)
    expect(m.update).toHaveBeenCalledWith({
      where: { id: 'challenge', consumedAt: null, revokedAt: null, failedAttempts: 4 },
      data: { failedAttempts: 5, lockedUntil: expect.any(Date) },
    })
  })

  it.each([
    ['another worker', { authenticatedWorkerUserId: 'outsider' }],
    ['stale epoch', { expectedVersion: 5 }],
    ['wrong purpose', { purpose: 'WORK_START' }],
    ['malformed PIN', { pin: '12345' }],
    ['weak key', { signingKey: Buffer.from('short') }],
  ])('refuses %s before challenge consumption', async (_name, patch) => {
    await expect(verify(patch)).rejects.toThrow()
    expect(m.update).not.toHaveBeenCalled()
  })

  it('denies any photo mismatch or worker suspension without consuming a code', async () => {
    m.match.mockResolvedValue({ status: 'MISMATCH_REPORTED' })
    await expect(verify()).rejects.toThrow('photo confirmation')
    expect(m.update).not.toHaveBeenCalled()
    m.match.mockClear()
    m.schedule.mockRejectedValue(new Error('Worker membership or role changed'))
    await expect(verify()).rejects.toThrow('Worker membership')
    expect(m.update).not.toHaveBeenCalled()
  })

  it('refuses missing, locked, expired, wrong-job, consumed PIN or active legacy PIN', async () => {
    m.pinState.mockResolvedValue({ id: 'legacy-pin' })
    await expect(verify()).rejects.toThrow('old arrival')
    m.pinState.mockResolvedValue(null)
    for (const c of [
      undefined,
      { ...challenge(), jobId: 'other-job' },
      { ...challenge(), issuedByCustomerUserId: 'other-customer' },
      { ...challenge(), expiredAt: null, expiresAt: new Date(Date.now() - 1) },
      { ...challenge(), failedAttempts: 5 },
      { ...challenge(), lockedUntil: new Date(Date.now() + 60000) },
    ]) {
      m.sql.mockReset().mockResolvedValueOnce([{ id: 'quote' }])
        .mockResolvedValueOnce([{ id: 'job', status: 'QUOTE_ACCEPTED',
          workersCount: 2, customerId: 'customer', preferredDate: null,
          preferredTimeSlot: null }])
        .mockResolvedValueOnce([{ id: 'crew', companyId: 'company', jobId: 'job',
          version: 4, requiredWorkersCount: 2, status: 'FORMING',
          leadWorkerUserId: 'worker-a' }])
        .mockResolvedValueOnce(c ? [c] : [])
      await expect(verify()).rejects.toThrow('unavailable or locked')
      expect(m.update).not.toHaveBeenCalled()
    }
  })

  it('fails closed if an atomic consume or attempt counter loses a race', async () => {
    m.update.mockResolvedValue({ count: 0 })
    await expect(verify()).rejects.toThrow('already consumed')
    expect(m.update).toHaveBeenCalledOnce()
  })

  it('stays internal; no route offers crew arrival or work start', () => {
    for (const path of [
      'app/api/mobile/worker/crew/route.ts',
      'app/api/mobile/company/crew/roster/route.ts',
      'app/api/mobile/company/crew/evidence/route.ts',
    ]) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8')
      expect(source).not.toContain('consumeStagedCrewMemberPinInsideTransaction')
    }
    const oldPin = readFileSync(resolve(process.cwd(), 'lib/domain/job-pin.ts'), 'utf8')
    expect(oldPin).toContain('Multi-worker jobs require crew-specific PIN verification')
  })
})
