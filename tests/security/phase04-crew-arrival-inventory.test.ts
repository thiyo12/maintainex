import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertCrewArrivalChallengeInventoryInsideTransaction } from '@/lib/domain/company-crew-arrival-inventory'

const m = vi.hoisted(() => ({
  barrier: vi.fn(), key: vi.fn(), booking: vi.fn(),
  slots: vi.fn(), challenges: vi.fn(),
}))
vi.mock('@/lib/domain/company-crew-barrier', () => ({
  assertStagedCrewIdentityEvidenceInsideTransaction: m.barrier,
}))
vi.mock('@/lib/domain/company-crew-commit-gate', () => ({
  CrewCommitGateError: class CrewCommitGateError extends Error {
    constructor(message: string, public readonly status = 409) { super(message) }
  },
}))
const tx = {
  companyCrewDispatch: { findUnique: m.key },
  marketplaceJob: { findUnique: m.booking },
  companyJobAssignment: { findMany: m.slots },
  companyCrewPinChallenge: { findMany: m.challenges },
}
const input = {
  crewDispatchId: 'crew', expectedVersion: 3,
  actorUserId: 'manager', actorRole: 'DISPATCHER',
}
const slots = [
  { id: 'slot-a', workerUserId: 'worker-a', status: 'CREW_ACCEPTED', crewArrivedAt: null },
  { id: 'slot-b', workerUserId: 'worker-b', status: 'CREW_ACCEPTED', crewArrivedAt: null },
  { id: 'slot-c', workerUserId: 'worker-c', status: 'CREW_ACCEPTED', crewArrivedAt: null },
]
const challenge = (id: string, patch: Record<string, unknown> = {}) => ({
  assignmentId: id, crewDispatchId: 'crew', jobId: 'job', crewVersion: 3,
  purpose: 'ARRIVAL', challengeVersion: 1, pinDigest: 'a'.repeat(64),
  issuedByCustomerUserId: 'customer',
  createdAt: new Date(Date.now() - 1000),
  expiresAt: new Date(Date.now() + 300000),
  revokedAt: null, consumedAt: null, failedAttempts: 0, lockedUntil: null,
  ...patch,
})
const inspect = () => assertCrewArrivalChallengeInventoryInsideTransaction(tx as any, input)

describe('Phase04 arrival challenge inventory never grants arrival or work start', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.barrier.mockResolvedValue({
      crewDispatchId: 'crew', version: 3, requiredWorkersCount: 3,
      memberEvidenceComplete: true, dispatchEnabled: false,
      arrivalEnabled: false, workStartEnabled: false,
    })
    m.key.mockResolvedValue({ jobId: 'job' })
    m.booking.mockResolvedValue({ customerId: 'customer' })
    m.slots.mockResolvedValue(slots)
    m.challenges.mockResolvedValue(slots.map(s => challenge(s.id)))
  })

  it('requires all three distinct current customer-issued PIN challenges', async () => {
    expect(await inspect()).toEqual({
      crewDispatchId: 'crew', crewVersion: 3,
      memberChallengesReady: true, pendingMemberCount: 3,
      arrivalEnabled: false, workStartEnabled: false,
    })
    expect(m.barrier).toHaveBeenCalledWith(tx, input)
    expect(m.challenges).toHaveBeenCalledWith({
      where: { crewDispatchId: 'crew', crewVersion: 3, purpose: 'ARRIVAL' },
      orderBy: { challengeVersion: 'desc' },
    })
    expect(tx).not.toHaveProperty('jobWorkspace')
    expect(tx).not.toHaveProperty('jobVerificationPin')
  })

  it('rejects missing workers, extra obsolete assignments and mistaken count', async () => {
    m.challenges.mockResolvedValue(slots.slice(0, 2).map(s => challenge(s.id)))
    await expect(inspect()).rejects.toThrow('Every worker needs')
    m.challenges.mockResolvedValue([...slots.map(s => challenge(s.id)), challenge('old-slot')])
    await expect(inspect()).rejects.toThrow('obsolete assignment')
    m.slots.mockResolvedValue(slots.slice(0, 2))
    await expect(inspect()).rejects.toThrow('roster changed')
  })

  it('rejects any existing arrival, revoked/used/expired/locked/exhausted challenge', async () => {
    m.slots.mockResolvedValue([{ ...slots[0], crewArrivedAt: new Date() }, slots[1], slots[2]])
    await expect(inspect()).rejects.toThrow('roster changed')
    m.slots.mockResolvedValue(slots)
    for (const invalid of [
      { revokedAt: new Date() },
      { consumedAt: new Date() },
      { expiresAt: new Date(Date.now() - 300000) },
      { lockedUntil: new Date(Date.now() + 60000) },
      { failedAttempts: 5 },
      { pinDigest: '123456' },
      { issuedByCustomerUserId: 'unrelated-customer' },
      { jobId: 'other-job' },
      { crewVersion: 2 },
    ]) {
      m.challenges.mockResolvedValue([
        challenge('slot-a'), challenge('slot-b', invalid), challenge('slot-c'),
      ])
      await expect(inspect()).rejects.toThrow('Every worker needs')
    }
  })

  it('requires latest challenge and denies earlier live codes after rotation', async () => {
    m.challenges.mockResolvedValue([
      challenge('slot-a', { challengeVersion: 2, revokedAt: new Date() }),
      challenge('slot-a', { challengeVersion: 1 }),
      challenge('slot-b'), challenge('slot-c'),
    ])
    await expect(inspect()).rejects.toThrow('Every worker needs')
    m.challenges.mockResolvedValue([
      challenge('slot-a', { challengeVersion: 2 }),
      challenge('slot-a', { challengeVersion: 1 }),
      challenge('slot-b'), challenge('slot-c'),
    ])
    await expect(inspect()).rejects.toThrow('Every worker needs')
  })

  it('denies before any challenge read when manager/current roster/identity barrier fails', async () => {
    m.barrier.mockRejectedValue(new Error('Worker photo no longer verified'))
    await expect(inspect()).rejects.toThrow('Worker photo')
    expect(m.challenges).not.toHaveBeenCalled()
  })

  it('is internal-only; no public route can claim a challenge means group presence', () => {
    const path = 'lib/domain/company-crew-arrival-inventory.ts'
    const source = readFileSync(resolve(process.cwd(), path), 'utf8')
    expect(source).toContain('memberChallengesReady: true')
    expect(source).toContain('arrivalEnabled: false')
    expect(source).toContain('workStartEnabled: false')
    for (const route of [
      'app/api/mobile/worker/crew/route.ts',
      'app/api/mobile/company/crew/evidence/route.ts',
    ]) {
      expect(readFileSync(resolve(process.cwd(), route), 'utf8'))
        .not.toContain('assertCrewArrivalChallengeInventoryInsideTransaction')
    }
  })
})
