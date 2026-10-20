import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { issueStagedCrewArrivalPinsInsideTransaction } from '@/lib/domain/company-crew-pin-issue'

const m = vi.hoisted(() => ({
  key: vi.fn(), sql: vi.fn(), company: vi.fn(), market: vi.fn(),
  companyEligible: vi.fn(), workerEligible: vi.fn(), lockWorker: vi.fn(),
  oldPin: vi.fn(), safety: vi.fn(), existing: vi.fn(), slots: vi.fn(),
  photo: vi.fn(), match: vi.fn(), createMany: vi.fn(), audit: vi.fn(),
}))
vi.mock('@/lib/domain/company-crew-commit-gate', () => ({
  CrewCommitGateError: class CrewCommitGateError extends Error {
    constructor(message: string, public readonly status = 409) { super(message) }
  },
}))
vi.mock('@/lib/domain/company-job-assignment', () => ({
  lockAndAssertWorkerScheduleAvailable: m.lockWorker,
}))
vi.mock('@/lib/phase6/provider-eligibility', () => ({
  checkCompanyEligibility: m.companyEligible,
  checkCrewCandidateEligibility: m.workerEligible,
}))
vi.mock('@/lib/geography/market-engine', () => ({ requireJobMarket: m.market }))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: m.audit }))

const customerId = 'customer'
const acceptedAt = new Date(Date.now() - 60000)
const confirmedAt = new Date(acceptedAt.getTime() + 1000)
const workers = [
  { id: 'slot-a', workerUserId: 'worker-a', companyId: 'company', jobId: 'job',
    status: 'CREW_ACCEPTED', crewSlot: 1, crewRole: 'LEAD',
    acceptedAt, crewIdentityConfirmedAt: confirmedAt,
    crewArrivedAt: null, startedAt: null },
  { id: 'slot-b', workerUserId: 'worker-b', companyId: 'company', jobId: 'job',
    status: 'CREW_ACCEPTED', crewSlot: 2, crewRole: 'MEMBER',
    acceptedAt, crewIdentityConfirmedAt: confirmedAt,
    crewArrivedAt: null, startedAt: null },
]
const req = {
  crewDispatchId: 'crew', expectedVersion: 7,
  authenticatedCustomerUserId: customerId, signingKey: Buffer.alloc(32, 0x45),
}
const job = {
  id: 'job', customerId, status: 'QUOTE_ACCEPTED', workersCount: 2,
  countryCode: 'LK', latitude: null, longitude: null,
  targetTaskerId: null, preferredDate: null, preferredTimeSlot: null,
}
const crew = {
  id: 'crew', companyId: 'company', jobId: 'job', version: 7,
  requiredWorkersCount: 2, status: 'FORMING', leadWorkerUserId: 'worker-a',
}
const tx = {
  companyCrewDispatch: { findUnique: m.key },
  companyProfile: { findUnique: m.company },
  companyJobAssignment: { findMany: m.slots },
  jobVerificationPin: { findFirst: m.oldPin },
  jobWorkerIdentityCheck: { findFirst: m.safety, findUnique: m.match },
  companyCrewPinChallenge: { count: m.existing, createMany: m.createMany },
  providerIdentity: { findFirst: m.photo },
  $queryRaw: m.sql,
}
const issue = (patch: Record<string, unknown> = {}) =>
  issueStagedCrewArrivalPinsInsideTransaction(tx as any, { ...req, ...patch })
const sqlReady = () => m.sql.mockReset()
  .mockResolvedValueOnce([{ id: customerId, isActive: true, isSuspended: false, isBanned: false }])
  .mockResolvedValueOnce([{ id: 'quote' }])
  .mockResolvedValueOnce([job])
  .mockResolvedValueOnce([crew])

describe('Phase04 customer-bound two-worker PIN issuance: no arrival/work authority', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.key.mockResolvedValue({ jobId: 'job', companyId: 'company' })
    sqlReady()
    m.company.mockResolvedValue({ countryCode: 'LK', userId: 'founder' })
    m.market.mockReturnValue({ ok: true, countryCode: 'LK' })
    m.companyEligible.mockResolvedValue({ eligible: true })
    m.workerEligible.mockResolvedValue({ eligible: true })
    m.oldPin.mockResolvedValue(null)
    m.safety.mockResolvedValue(null)
    m.existing.mockResolvedValue(0)
    m.slots.mockResolvedValue(workers)
    m.photo.mockImplementation(async (args: any) => ({
      id: 'photo-' + args.where.currentUserId, verifiedPhotoUrl: '/approved',
    }))
    m.match.mockImplementation(async (args: any) => ({
      status: 'MATCHED',
      assignedWorkerUserId: args.where.jobId_providerIdentityId.providerIdentityId.slice(6),
      confirmedAt, photoSnapshotUrl: '/approved',
    }))
    m.createMany.mockResolvedValue({ count: 2 })
  })

  it('issues distinct scoped digests for all members and audits without enabling work', async () => {
    const result = await issue()
    expect(result.crewDispatchId).toBe('crew')
    expect(result.crewVersion).toBe(7)
    expect(result.arrivalEnabled).toBe(false)
    expect(result.workStartEnabled).toBe(false)
    expect(result.memberCodes.map(x => x.assignmentId).sort()).toEqual(['slot-a', 'slot-b'])
    expect(result.memberCodes.every(x => /^[1-9][0-9]{5}$/.test(x.pin))).toBe(true)
    const createArg = m.createMany.mock.calls[0][0]
    expect(createArg.data).toHaveLength(2)
    expect(createArg.data[0].purpose).toBe('ARRIVAL')
    expect(createArg.data[0].crewVersion).toBe(7)
    expect(createArg.data[0].issuedByCustomerUserId).toBe(customerId)
    expect(createArg.data.every((x: any) => !('pin' in x) && /^[a-f0-9]{64}$/.test(x.pinDigest)))
      .toBe(true)
    expect(new Set(createArg.data.map((x: any) => x.pinDigest)).size).toBe(2)
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREW_ARRIVAL_CHALLENGES_ISSUED', actorId: customerId,
      metadata: expect.objectContaining({ workerCount: 2, crewVersion: 7 }),
    }), tx)
    expect(m.lockWorker).toHaveBeenCalledTimes(2)
    expect(m.workerEligible).toHaveBeenCalledTimes(2)
    expect(tx).not.toHaveProperty('marketplaceJob')
    expect(tx).not.toHaveProperty('jobWorkspace')
  })

  it('rejects non-customer and restricted customer without PIN writes', async () => {
    sqlReady().mockResolvedValueOnce([])
    await expect(issue({ authenticatedCustomerUserId: 'attacker' }))
      .rejects.toThrow('not authorized')
    expect(m.createMany).not.toHaveBeenCalled()
    sqlReady()
    m.sql.mockReset().mockResolvedValueOnce([{
      id: customerId, isActive: true, isSuspended: true, isBanned: false,
    }])
    await expect(issue()).rejects.toThrow('not authorized')
    expect(m.createMany).not.toHaveBeenCalled()
  })

  it('refuses a stale epoch, mismatched photo and still-unaccepted coworker', async () => {
    await expect(issue({ expectedVersion: 8 })).rejects.toThrow('roster epoch')
    sqlReady()
    m.slots.mockResolvedValue([{ ...workers[0] }, { ...workers[1], status: 'CREW_RESERVED' }])
    await expect(issue()).rejects.toThrow('Every crew member')
    sqlReady()
    m.slots.mockResolvedValue(workers)
    m.match.mockResolvedValue({ status: 'MISMATCH_REPORTED' })
    await expect(issue()).rejects.toThrow('photo confirmation')
    expect(m.createMany).not.toHaveBeenCalled()
  })

  it('blocks any earlier arrival/PIN, safety mismatch or already-issued codes', async () => {
    m.oldPin.mockResolvedValue({ id: 'pin' })
    await expect(issue()).rejects.toThrow('cannot be issued again')
    sqlReady()
    m.oldPin.mockResolvedValue(null)
    m.safety.mockResolvedValue({ id: 'mismatch' })
    await expect(issue()).rejects.toThrow('cannot be issued again')
    sqlReady()
    m.safety.mockResolvedValue(null)
    m.existing.mockResolvedValue(1)
    await expect(issue()).rejects.toThrow('cannot be issued again')
    expect(m.createMany).not.toHaveBeenCalled()
  })

  it('fails closed when one member loses eligibility or the atomic batch writes partially', async () => {
    m.workerEligible.mockResolvedValue({ eligible: false })
    await expect(issue()).rejects.toThrow('no longer eligible')
    expect(m.createMany).not.toHaveBeenCalled()
    sqlReady()
    m.workerEligible.mockResolvedValue({ eligible: true })
    m.createMany.mockResolvedValue({ count: 1 })
    await expect(issue()).rejects.toThrow('atomically for all')
    expect(m.audit).not.toHaveBeenCalled()
  })

  it('does not enable production issuance or expose customer codes through any route', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    try {
      await expect(issue()).rejects.toThrow('not enabled')
      expect(m.sql).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
    }
    for (const path of [
      'app/api/mobile/v2/jobs/[id]/crew-identity/route.ts',
      'app/api/mobile/company/crew/roster/route.ts',
      'app/api/mobile/worker/crew/route.ts',
    ]) {
      expect(readFileSync(resolve(process.cwd(), path), 'utf8'))
        .not.toContain('issueStagedCrewArrivalPinsInsideTransaction')
    }
  })
})
