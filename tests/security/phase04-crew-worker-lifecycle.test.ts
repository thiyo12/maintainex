import { beforeEach, describe, expect, it, vi } from 'vitest'
import { acceptStagedCrewMemberInsideTransaction, rejectStagedCrewMemberInsideTransaction } from '@/lib/domain/company-crew-lifecycle'

const mocks = vi.hoisted(() => ({
  sql: vi.fn(), crewLookup: vi.fn(), company: vi.fn(), slots: vi.fn(),
  update: vi.fn(), blockCrew: vi.fn(), schedule: vi.fn(), eligibility: vi.fn(),
  companyEligibility: vi.fn(), market: vi.fn(), arrival: vi.fn(),
  mismatch: vi.fn(), audit: vi.fn(),
}))
vi.mock('@/lib/geography/market-engine', () => ({ requireJobMarket: mocks.market }))
vi.mock('@/lib/phase6/provider-eligibility', () => ({
  checkCompanyEligibility: mocks.companyEligibility,
  checkCrewCandidateEligibility: mocks.eligibility,
}))
vi.mock('@/lib/domain/company-job-assignment', () => ({
  lockAndAssertWorkerScheduleAvailable: mocks.schedule,
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: mocks.audit }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

const tx = {
  $queryRaw: mocks.sql,
  companyCrewDispatch: { findUnique: mocks.crewLookup, updateMany: mocks.blockCrew },
  companyProfile: { findUnique: mocks.company },
  companyJobAssignment: { findMany: mocks.slots, updateMany: mocks.update },
  jobVerificationPin: { findFirst: mocks.arrival },
  jobWorkerIdentityCheck: { findFirst: mocks.mismatch },
}
const job = {
  id: 'booking', status: 'QUOTE_ACCEPTED', workersCount: 2,
  countryCode: 'LK', latitude: null, longitude: null,
  preferredDate: null, preferredTimeSlot: null, targetTaskerId: null,
}
const crew = {
  id: 'crew', companyId: 'company', jobId: 'booking',
  requiredWorkersCount: 2, leadWorkerUserId: 'worker-a', status: 'FORMING', version: 1,
}
const slots = [
  { id: 'slot-a', companyId: 'company', jobId: 'booking', workerUserId: 'worker-a', status: 'CREW_RESERVED', crewSlot: 1, crewRole: 'LEAD' },
  { id: 'slot-b', companyId: 'company', jobId: 'booking', workerUserId: 'worker-b', status: 'CREW_ACCEPTED', crewSlot: 2, crewRole: 'MEMBER' },
]
const input = { crewDispatchId: 'crew', workerUserId: 'worker-a', expectedVersion: 1 }
const accept = () => acceptStagedCrewMemberInsideTransaction(tx as any, input)

describe('Phase 04 — accepting a staged crew slot never authorizes work', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.crewLookup.mockResolvedValue({ companyId: 'company', jobId: 'booking' })
    mocks.sql.mockResolvedValueOnce([{ id: 'accepted-quote' }])
      .mockResolvedValueOnce([job]).mockResolvedValueOnce([crew])
    mocks.company.mockResolvedValue({ countryCode: 'LK', userId: 'founder' })
    mocks.slots.mockResolvedValue(slots)
    mocks.update.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 })
    mocks.blockCrew.mockResolvedValue({ count: 1 })
    mocks.companyEligibility.mockResolvedValue({ eligible: true, reasons: [] })
    mocks.eligibility.mockResolvedValue({ eligible: true, reasons: [] })
    mocks.market.mockReturnValue({ ok: true, countryCode: 'LK' })
    mocks.arrival.mockResolvedValue(null)
    mocks.mismatch.mockResolvedValue(null)
  })

  it('accepts only its own slot with fresh identity and leaves crew FORMING', async () => {
    expect(await accept()).toEqual({
      crewDispatchId: 'crew', acceptedWorkersCount: 2,
      requiredWorkersCount: 2, status: 'FORMING', dispatchEnabled: false,
    })
    expect(mocks.schedule).toHaveBeenCalledWith(
      tx, 'worker-a', 'booking', null, null, 'company', true,
    )
    expect(mocks.eligibility).toHaveBeenCalledWith('company', 'worker-a', 'booking', tx)
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'slot-a', companyId: 'company', jobId: 'booking',
        workerUserId: 'worker-a', crewDispatchId: 'crew', status: 'CREW_RESERVED' },
      data: { status: 'CREW_ACCEPTED', acceptedAt: expect.any(Date) },
    })
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREW_MEMBER_ACCEPT', actorId: 'worker-a' }), tx,
    )
    expect(tx).not.toHaveProperty('jobWorkspace')
    expect(tx).not.toHaveProperty('marketplaceJob')
  })

  it('never reveals an unrelated crew without accepted quote', async () => {
    mocks.sql.mockReset().mockResolvedValueOnce([])
    await expect(accept()).rejects.toThrow('no longer has an accepted quote')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('denies accepting somebody else’s slot', async () => {
    input.workerUserId = 'unselected-worker'
    try {
      await expect(accept()).rejects.toMatchObject({ status: 404 })
    } finally { input.workerUserId = 'worker-a' }
    expect(mocks.schedule).not.toHaveBeenCalled()
  })

  it('denies a stale roster epoch', async () => {
    input.expectedVersion = 2
    try { await expect(accept()).rejects.toThrow('Crew version') }
    finally { input.expectedVersion = 1 }
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('does not double-accept the same slot or accept an incomplete roster', async () => {
    mocks.slots.mockResolvedValue([{ ...slots[0], status: 'CREW_ACCEPTED' }, slots[1]])
    await expect(accept()).rejects.toThrow('already been answered')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('blocks worker suspension or withdrawn photo at transaction time', async () => {
    mocks.schedule.mockRejectedValue(new Error('Worker verified photo is no longer approved'))
    await expect(accept()).rejects.toThrow('verified photo')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('blocks a late safety mismatch even after worker eligibility passes', async () => {
    mocks.mismatch.mockResolvedValue({ id: 'safety-case' })
    await expect(accept()).rejects.toThrow('safety review')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('fails closed if the conditional slot update loses an acceptance race', async () => {
    mocks.update.mockResolvedValue({ count: 0 })
    await expect(accept()).rejects.toThrow('concurrently')
    expect(mocks.audit).not.toHaveBeenCalled()
  })

  it('declining after another member accepted blocks crew and releases all slots', async () => {
    const result = await rejectStagedCrewMemberInsideTransaction(tx as any, {
      ...input, reason: 'No longer available',
    })
    expect(result).toEqual({
      crewDispatchId: 'crew', status: 'BLOCKED', version: 2,
      releasedWorkersCount: 2, dispatchEnabled: false,
    })
    expect(mocks.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'slot-a', companyId: 'company', jobId: 'booking',
        workerUserId: 'worker-a', crewDispatchId: 'crew', status: 'CREW_RESERVED' },
      data: { status: 'REJECTED', rejectedAt: expect.any(Date),
        rejectReason: 'No longer available' },
    })
    expect(mocks.update).toHaveBeenNthCalledWith(2, {
      where: { crewDispatchId: 'crew', id: { not: 'slot-a' },
        status: { in: ['CREW_RESERVED', 'CREW_ACCEPTED'] } },
      data: { status: 'REVOKED', revokedAt: expect.any(Date),
        revokedReason: 'Crew blocked by worker refusal' },
    })
    expect(mocks.blockCrew).toHaveBeenCalledWith({
      where: { id: 'crew', status: 'FORMING', version: 1 },
      data: { status: 'BLOCKED', version: { increment: 1 } },
    })
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREW_MEMBER_REJECT', actorId: 'worker-a' }), tx,
    )
  })

  it('refusal fails atomically if any companion slot changed', async () => {
    mocks.update.mockReset().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })
    await expect(rejectStagedCrewMemberInsideTransaction(tx as any, input))
      .rejects.toThrow('slots changed')
    expect(mocks.blockCrew).not.toHaveBeenCalled()
    expect(mocks.audit).not.toHaveBeenCalled()
  })

  it('refusal never accepts an invalid reason or an obsolete crew version', async () => {
    await expect(rejectStagedCrewMemberInsideTransaction(tx as any, {
      ...input, reason: 'x'.repeat(251),
    })).rejects.toMatchObject({ status: 400 })
    expect(mocks.crewLookup).not.toHaveBeenCalled()
    await expect(rejectStagedCrewMemberInsideTransaction(tx as any, {
      ...input, expectedVersion: 9,
    })).rejects.toThrow('Crew version')
  })

  it('a worker whose crew invitation was already revoked cannot refuse again', async () => {
    mocks.slots.mockResolvedValue([{ ...slots[0], status: 'REVOKED' }, slots[1]])
    await expect(rejectStagedCrewMemberInsideTransaction(tx as any, input))
      .rejects.toThrow('incomplete or inconsistent')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('rejects internally inconsistent slots rather than claiming partial acceptance', async () => {
    mocks.slots.mockResolvedValue([slots[0]])
    await expect(accept()).rejects.toThrow('incomplete or inconsistent')
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
