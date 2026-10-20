import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decideCrewWorkerIdentityInsideTransaction } from '@/lib/domain/company-crew-identity'

const m = vi.hoisted(() => ({
  lookup: vi.fn(), key: vi.fn(), sql: vi.fn(), slots: vi.fn(),
  unsafe: vi.fn(), pin: vi.fn(), photo: vi.fn(), check: vi.fn(),
  upsert: vi.fn(), slotUpdate: vi.fn(), block: vi.fn(),
  signal: vi.fn(), risk: vi.fn(), audit: vi.fn(),
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: m.audit }))
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
