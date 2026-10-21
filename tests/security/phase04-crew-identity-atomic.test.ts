import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decideCrewWorkerIdentityInsideTransaction } from '@/lib/domain/company-crew-identity'

const m = vi.hoisted(() => ({
  lookup: vi.fn(), key: vi.fn(), sql: vi.fn(), slots: vi.fn(),
  unsafe: vi.fn(), pin: vi.fn(), photo: vi.fn(), check: vi.fn(),
  upsert: vi.fn(), slotUpdate: vi.fn(), block: vi.fn(),
  signal: vi.fn(), risk: vi.fn(), audit: vi.fn(), pinRevoke: vi.fn(),
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: m.audit }))
vi.mock('@/lib/domain/company-crew-pin-revocation', () => ({
  revokeCrewPinChallengesInsideTransaction: m.pinRevoke,
}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
const crew = {
  id: 'crew', companyId: 'company', jobId: 'booking', status: 'FORMING',
  version: 1, requiredWorkersCount: 2, leadWorkerUserId: 'a',
}
const job = { id: 'booking', customerId: 'customer', status: 'QUOTE_ACCEPTED', workersCount: 2 }
const slot = (id: string, status: string) => ({
  id: 'slot-' + id, companyId: 'company', jobId: 'booking',
  workerUserId: id, status, crewSlot: id === 'a' ? 1 : 2,
  crewRole: id === 'a' ? 'LEAD' : 'MEMBER',
  acceptedAt: status === 'CREW_ACCEPTED' ? new Date() : null,
  startedAt: null, crewArrivedAt: null,
})
const tx = {
  marketplaceJob: { findUnique: m.lookup },
  companyCrewDispatch: { findUnique: m.key, updateMany: m.block },
  $queryRaw: m.sql,
  companyJobAssignment: { findMany: m.slots, updateMany: m.slotUpdate },
  jobWorkerIdentityCheck: { findFirst: m.unsafe, findUnique: m.check, upsert: m.upsert },
  jobVerificationPin: { findFirst: m.pin },
  providerIdentity: { findFirst: m.photo },
  providerIntegritySignal: { create: m.signal },
  marketplaceRiskEvent: { create: m.risk },
}
const input = {
  jobId: 'booking', crewDispatchId: 'crew', assignmentId: 'slot-a',
  customerUserId: 'customer', expectedVersion: 1, decision: 'MATCH' as const,
}
const decide = (override: Record<string, unknown> = {}) =>
  decideCrewWorkerIdentityInsideTransaction(tx as any, { ...input, ...override } as any)

describe('Phase04 customer photo decisions cannot grant crew work', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.lookup.mockResolvedValue({ customerId: 'customer' })
    m.key.mockResolvedValue({ companyId: 'company', jobId: 'booking' })
    m.sql.mockResolvedValueOnce([{ id: 'quote' }]).mockResolvedValueOnce([job])
      .mockResolvedValueOnce([crew]).mockResolvedValueOnce([{
        id: 'a', name: 'Worker A', isActive: true, isSuspended: false,
        isBanned: false, identityStatus: 'VERIFIED',
      }]).mockResolvedValueOnce([{ role: 'WORKER', status: 'ACTIVE' }])
    m.slots.mockResolvedValue([slot('a', 'CREW_ACCEPTED'), slot('b', 'CREW_RESERVED')])
    m.unsafe.mockResolvedValue(null)
    m.pin.mockResolvedValue(null)
    m.photo.mockResolvedValue({
      id: 'photo-a', verifiedPhotoUrl: '/verified-a',
      kycStatus: 'VERIFIED', verifiedDisplayName: 'Worker A',
    })
    m.check.mockResolvedValue(null)
    m.slotUpdate.mockResolvedValue({ count: 1 })
    m.block.mockResolvedValue({ count: 1 })
    m.pinRevoke.mockResolvedValue({ revokedPinChallenges: 0, consumedClaimsPreserved: 0 })
  })

  it('valid customer MATCH records one slot without turning FORMING into work authority', async () => {
    expect(await decide()).toMatchObject({
      status: 'FORMING', customerConfirmed: true, dispatchEnabled: false,
    })
    expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        customerId: 'customer', assignedWorkerUserId: 'a',
        status: 'MATCHED', photoSnapshotUrl: '/verified-a',
      }),
    }))
    expect(m.slotUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'slot-a', status: 'CREW_ACCEPTED' }),
      data: { crewIdentityConfirmedAt: expect.any(Date) },
    }))
    expect(m.block).not.toHaveBeenCalled()
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREW_IDENTITY_CONFIRMED' }), tx,
    )
  })

  it('denies outsider and stale crew epoch before reading personal photo', async () => {
    await expect(decide({ customerUserId: 'outsider' })).rejects.toMatchObject({ status: 404 })
    expect(m.photo).not.toHaveBeenCalled()
    m.sql.mockReset().mockResolvedValueOnce([{ id: 'quote' }])
      .mockResolvedValueOnce([job]).mockResolvedValueOnce([{ ...crew, version: 3 }])
    await expect(decide()).rejects.toThrow('version changed')
  })

  it('cannot confirm unaccepted or suspended workers', async () => {
    m.slots.mockResolvedValue([slot('a', 'CREW_RESERVED'), slot('b', 'CREW_ACCEPTED')])
    await expect(decide()).rejects.toThrow('accept')
    expect(m.upsert).not.toHaveBeenCalled()
    m.slots.mockResolvedValue([slot('a', 'CREW_ACCEPTED'), slot('b', 'CREW_RESERVED')])
    m.sql.mockReset().mockResolvedValueOnce([{ id: 'quote' }])
      .mockResolvedValueOnce([job]).mockResolvedValueOnce([crew])
      .mockResolvedValueOnce([{ id: 'a', isActive: true, isSuspended: true,
        isBanned: false, identityStatus: 'VERIFIED' }])
      .mockResolvedValueOnce([{ role: 'WORKER', status: 'ACTIVE' }])
    await expect(decide()).rejects.toThrow('no longer valid')
    expect(m.slotUpdate).not.toHaveBeenCalled()
  })

  it('MATCH uses the same latest verified personal photo source as the customer preview', async () => {
    await decide()
    expect(m.photo).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        currentUserId: 'a',
        identityType: { in: ['TASKER', 'COMPANY_WORKER'] },
        kycStatus: 'VERIFIED',
        verifiedPhotoUrl: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
    }))
  })

  it('still accepts identity mismatch reports when an employee photo is revoked', async () => {
    m.photo.mockResolvedValue(null)
    m.slotUpdate.mockResolvedValue({ count: 2 })
    await decide({ decision: 'MISMATCH', reason: 'Photo removed' })
    expect(m.photo).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        currentUserId: 'a',
        identityType: { in: ['TASKER', 'COMPANY_WORKER'] },
      },
    }))
  })

  it('safety mismatch releases all holds, increments crew epoch and preserves signals', async () => {
    m.slotUpdate.mockResolvedValue({ count: 2 })
    expect(await decide({ decision: 'MISMATCH', reason: 'Not that worker' })).toMatchObject({
      status: 'BLOCKED', version: 2,
      safetyReviewRequired: true, dispatchEnabled: false,
    })
    expect(m.slotUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'REVOKED' }),
    }))
    expect(m.signal).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ severity: 'HIGH', status: 'OPEN' }),
    }))
    expect(m.risk).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'WORKER_IDENTITY_MISMATCH' }),
    }))
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREW_IDENTITY_MISMATCH' }), tx,
    )
  })

  it('customer MISMATCH AFTER any consumed PIN blocks crew but preserves all worker capacity for human safety review', async () => {
    m.slots.mockResolvedValue([slot('a', 'CREW_ACCEPTED'), slot('b', 'CREW_ACCEPTED')])
    m.pinRevoke.mockResolvedValue({
      revokedPinChallenges: 1, consumedClaimsPreserved: 1,
    })
    const result = await decide({ decision: 'MISMATCH', reason: 'Wrong worker at site' })
    expect(result).toMatchObject({
      status: 'BLOCKED', version: 2, customerConfirmed: false,
      safetyReviewRequired: true, dispatchEnabled: false,
    })
    expect(m.pinRevoke).toHaveBeenCalledWith(tx, {
      crewDispatchId: 'crew', crewVersion: 1, allowConsumedEvidence: true,
    })
    expect(m.slotUpdate).not.toHaveBeenCalled()
    expect(m.block).toHaveBeenCalledWith({
      where: { id: 'crew', status: 'FORMING', version: 1 },
      data: { status: 'BLOCKED', version: { increment: 1 } },
    })
    expect(m.signal).toHaveBeenCalledOnce()
    expect(m.risk).toHaveBeenCalledOnce()
    expect(m.risk).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobId: 'booking', actorUserId: 'customer',
        eventType: 'WORKER_IDENTITY_MISMATCH', severity: 'HIGH',
      }),
    })
    expect(JSON.parse(m.risk.mock.calls[0][0].data.metadata)).toMatchObject({
      companyId: 'company', crewId: 'crew',
      assignmentId: 'slot-a', workerUserId: 'a',
      previousVersion: 1, blockedVersion: 2,
      consumedPinsPreserved: 1, capacityHeldForReview: 2,
    })
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREW_IDENTITY_MISMATCH',
      metadata: expect.objectContaining({
        consumedPinsPreserved: 1,
        unusedPinsRevoked: 1,
        capacityHeldForReview: 2,
        releasedWorkersCount: 0,
      }),
    }), tx)
  })

  it('no consumed PIN permits ordinary all-worker release after a mismatch', async () => {
    m.pinRevoke.mockResolvedValue({
      revokedPinChallenges: 2, consumedClaimsPreserved: 0,
    })
    m.slotUpdate.mockResolvedValue({ count: 2 })
    await decide({ decision: 'MISMATCH' })
    expect(m.slotUpdate).toHaveBeenCalledOnce()
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        capacityHeldForReview: 0,
        releasedWorkersCount: 2,
      }),
    }), tx)
  })

  it('mismatch still blocks the entire crew if the verified worker photo vanished', async () => {
    m.photo.mockResolvedValue(null)
    m.slotUpdate.mockResolvedValue({ count: 2 })
    expect(await decide({ decision: 'MISMATCH' })).toMatchObject({
      status: 'BLOCKED', safetyReviewRequired: true,
    })
    expect(m.signal).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ providerIdentityId: null }),
    }))
  })
})
