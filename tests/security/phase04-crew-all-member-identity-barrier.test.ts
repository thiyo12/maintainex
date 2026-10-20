import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertStagedCrewIdentityEvidenceInsideTransaction } from '@/lib/domain/company-crew-barrier'

const mocks = vi.hoisted(() => ({
  crewKey: vi.fn(), sql: vi.fn(), company: vi.fn(), companyEligible: vi.fn(),
  actor: vi.fn(), schedule: vi.fn(), workerEligible: vi.fn(), market: vi.fn(),
  pin: vi.fn(), safety: vi.fn(), slots: vi.fn(), photo: vi.fn(), matched: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/geography/market-engine', () => ({ requireJobMarket: mocks.market }))
vi.mock('@/lib/phase6/provider-eligibility', () => ({
  checkCompanyEligibility: mocks.companyEligible,
  checkCrewCandidateEligibility: mocks.workerEligible,
}))
vi.mock('@/lib/domain/company-job-assignment', () => ({
  lockAndAssertAssignmentActorAuthorized: mocks.actor,
  lockAndAssertWorkerScheduleAvailable: mocks.schedule,
}))

const now = new Date('2026-10-20T06:00:00.000Z')
const job = {
  id: 'booking', status: 'QUOTE_ACCEPTED', workersCount: 2,
  countryCode: 'LK', latitude: null, longitude: null,
  preferredDate: null, preferredTimeSlot: null, targetTaskerId: null,
}
const crew = {
  id: 'crew', companyId: 'company', jobId: 'booking',
  status: 'FORMING', version: 4, leadWorkerUserId: 'a', requiredWorkersCount: 2,
}
const slots = [
  { id: 'slot-a', companyId: 'company', jobId: 'booking',
    workerUserId: 'a', crewSlot: 1, crewRole: 'LEAD', status: 'CREW_ACCEPTED',
    acceptedAt: now, crewIdentityConfirmedAt: now, crewArrivedAt: null, startedAt: null },
  { id: 'slot-b', companyId: 'company', jobId: 'booking',
    workerUserId: 'b', crewSlot: 2, crewRole: 'MEMBER', status: 'CREW_ACCEPTED',
    acceptedAt: now, crewIdentityConfirmedAt: now, crewArrivedAt: null, startedAt: null },
]
const tx = {
  companyCrewDispatch: { findUnique: mocks.crewKey },
  $queryRaw: mocks.sql,
  companyProfile: { findUnique: mocks.company },
  jobVerificationPin: { findFirst: mocks.pin },
  jobWorkerIdentityCheck: {
    findFirst: mocks.safety,
    findUnique: mocks.matched,
  },
  companyJobAssignment: { findMany: mocks.slots },
  providerIdentity: { findFirst: mocks.photo },
}
const input = {
  crewDispatchId: 'crew', expectedVersion: 4,
  actorUserId: 'manager', actorRole: 'DISPATCHER',
}
const verify = (patch = {}) =>
  assertStagedCrewIdentityEvidenceInsideTransaction(tx as any, { ...input, ...patch })

describe('Phase04 crew all-worker identity barrier: internal-only and fail-closed', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.crewKey.mockResolvedValue({ companyId: 'company', jobId: 'booking' })
    mocks.sql.mockResolvedValueOnce([{ id: 'quote' }])
      .mockResolvedValueOnce([job]).mockResolvedValueOnce([crew])
    mocks.company.mockResolvedValue({ countryCode: 'LK', userId: 'owner' })
    mocks.companyEligible.mockResolvedValue({ eligible: true })
    mocks.workerEligible.mockResolvedValue({ eligible: true })
    mocks.market.mockReturnValue({ ok: true, countryCode: 'LK' })
    mocks.pin.mockResolvedValue(null)
    mocks.safety.mockResolvedValue(null)
    mocks.slots.mockResolvedValue([...slots].reverse())
    mocks.photo.mockImplementation(async ({ where }) => ({
      id: 'photo-' + where.currentUserId,
      verifiedPhotoUrl: '/approved-' + where.currentUserId,
    }))
    mocks.matched.mockImplementation(async ({ where }) => {
      const workerId = where.jobId_providerIdentityId.providerIdentityId.slice(-1)
      return {
        status: 'MATCHED',
        assignedWorkerUserId: workerId,
        photoSnapshotUrl: '/approved-' + workerId,
        confirmedAt: now,
      }
    })
  })

  it('requires every employee to accept and reconfirm currently verified photos', async () => {
    const result = await verify()
    expect(result).toEqual({
      crewDispatchId: 'crew', version: 4, requiredWorkersCount: 2,
      memberEvidenceComplete: true,
      dispatchEnabled: false, arrivalEnabled: false, workStartEnabled: false,
    })
    expect(mocks.actor).toHaveBeenCalledWith(tx, 'company', 'manager', 'DISPATCHER')
    expect(mocks.schedule).toHaveBeenNthCalledWith(
      1, tx, 'a', 'booking', null, null, 'company', true,
    )
    expect(mocks.schedule).toHaveBeenNthCalledWith(
      2, tx, 'b', 'booking', null, null, 'company', true,
    )
    expect(mocks.workerEligible).toHaveBeenCalledTimes(2)
    expect(mocks.matched).toHaveBeenCalledTimes(2)
    expect(tx).not.toHaveProperty('marketplaceJob')
    expect(tx).not.toHaveProperty('jobWorkspace')
    expect(tx).not.toHaveProperty('payment')
  })

  it('refuses partial response, wrong lead, or inconsistent reserved member', async () => {
    mocks.slots.mockResolvedValue([
      slots[0], { ...slots[1], status: 'CREW_RESERVED', acceptedAt: null },
    ])
    await expect(verify()).rejects.toThrow('All crew members must accept')
    expect(mocks.schedule).not.toHaveBeenCalled()
    mocks.sql.mockReset().mockResolvedValueOnce([{ id: 'quote' }])
      .mockResolvedValueOnce([job]).mockResolvedValueOnce([{ ...crew, leadWorkerUserId: 'outsider' }])
    mocks.slots.mockResolvedValue(slots)
    await expect(verify()).rejects.toThrow('All crew members must accept')
  })

  it('requires fresh individual MATCHED photo snapshots for both workers', async () => {
    mocks.matched.mockResolvedValue({
      status: 'MATCHED', assignedWorkerUserId: 'a',
      photoSnapshotUrl: '/old-photo', confirmedAt: now,
    })
    await expect(verify()).rejects.toThrow('photo confirmation is missing or stale')
  })

  it('a safety mismatch or prior arrival always blocks the barrier', async () => {
    mocks.safety.mockResolvedValue({ id: 'mismatch' })
    await expect(verify()).rejects.toThrow('safety review')
    expect(mocks.schedule).not.toHaveBeenCalled()
    mocks.safety.mockResolvedValue(null)
    mocks.sql.mockReset().mockResolvedValueOnce([{ id: 'quote' }])
      .mockResolvedValueOnce([job]).mockResolvedValueOnce([crew])
    mocks.pin.mockResolvedValue({ id: 'pin' })
    await expect(verify()).rejects.toThrow('PIN')
  })

  it('a suspended or no-longer-qualified worker cannot pass a stale photo receipt', async () => {
    mocks.schedule.mockRejectedValue(new Error('Worker identity or account status changed'))
    await expect(verify()).rejects.toThrow('Worker identity')
    expect(mocks.matched).not.toHaveBeenCalled()
    mocks.schedule.mockReset()
    mocks.sql.mockReset().mockResolvedValueOnce([{ id: 'quote' }])
      .mockResolvedValueOnce([job]).mockResolvedValueOnce([crew])
    mocks.workerEligible.mockResolvedValue({ eligible: false })
    await expect(verify()).rejects.toThrow('lost service or market eligibility')
  })

  it('rejects a stale epoch or removed dispatcher before reading worker identities', async () => {
    await expect(verify({ expectedVersion: 3 })).rejects.toThrow('epoch')
    expect(mocks.photo).not.toHaveBeenCalled()
    mocks.actor.mockRejectedValue(new Error('Assigning actor is no longer authorized'))
    await expect(verify()).rejects.toThrow('no longer authorized')
    expect(mocks.photo).not.toHaveBeenCalled()
  })
})
