import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertAllCrewPinClaimsInsideTransaction } from '@/lib/domain/company-crew-pin-claims'

const m = vi.hoisted(() => ({
  barrier: vi.fn(), key: vi.fn(), job: vi.fn(), roster: vi.fn(), claims: vi.fn(),
}))
vi.mock('@/lib/domain/company-crew-barrier', () => ({
  assertStagedCrewIdentityEvidenceInsideTransaction: m.barrier,
}))
vi.mock('@/lib/domain/company-crew-commit-gate', () => ({
  CrewCommitGateError: class CrewCommitGateError extends Error {
    constructor(message: string, public readonly status = 409) { super(message) }
  },
}))
const slots = [
  { id: 'slot-a', status: 'CREW_ACCEPTED', crewArrivedAt: null, startedAt: null },
  { id: 'slot-b', status: 'CREW_ACCEPTED', crewArrivedAt: null, startedAt: null },
  { id: 'slot-c', status: 'CREW_ACCEPTED', crewArrivedAt: null, startedAt: null },
]
const now = new Date()
const claim = (assignmentId: string, overrides: Record<string, unknown> = {}) => ({
  id: 'claim-' + assignmentId,
  assignmentId, jobId: 'job', crewVersion: 7,
  issuedByCustomerUserId: 'customer',
  purpose: 'ARRIVAL',
  challengeVersion: 1,
  pinDigest: 'a'.repeat(64),
  createdAt: new Date(now.getTime() - 120000),
  consumedAt: new Date(now.getTime() - 60000),
  expiresAt: new Date(now.getTime() + 240000),
  revokedAt: null, failedAttempts: 0, lockedUntil: null,
  ...overrides,
})
const tx = {
  companyCrewDispatch: { findUnique: m.key },
  marketplaceJob: { findUnique: m.job },
  companyJobAssignment: { findMany: m.roster },
  companyCrewPinChallenge: { findMany: m.claims },
}
const input = {
  crewDispatchId: 'crew', expectedVersion: 7,
  actorUserId: 'manager', actorRole: 'COMPANY_OWNER',
}
const verify = () => assertAllCrewPinClaimsInsideTransaction(tx as any, input)

describe('Phase04 all-member PIN claims barrier (no physical presence or start authority)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.barrier.mockResolvedValue({
      crewDispatchId: 'crew', version: 7, requiredWorkersCount: 3,
      memberEvidenceComplete: true,
      arrivalEnabled: false, workStartEnabled: false, dispatchEnabled: false,
    })
    m.key.mockResolvedValue({ jobId: 'job' })
    m.job.mockResolvedValue({ customerId: 'customer' })
    m.roster.mockResolvedValue(slots)
    m.claims.mockResolvedValue(slots.map(s => claim(s.id)))
  })

  it('recognizes three independent customer-issued consumed PINs, never work authorization', async () => {
    expect(await verify()).toEqual({
      crewDispatchId: 'crew', crewVersion: 7, memberClaimsComplete: true,
      physicalPresenceVerified: false,
      arrivalEnabled: false, workStartEnabled: false,
    })
    expect(m.barrier).toHaveBeenCalledWith(tx, input)
    expect(m.claims).toHaveBeenCalledWith({
      where: { crewDispatchId: 'crew', purpose: 'ARRIVAL' },
      orderBy: { challengeVersion: 'desc' },
    })
    expect(tx).not.toHaveProperty('marketplaceJob.update')
    expect(tx).not.toHaveProperty('jobWorkspace')
    expect(tx.companyCrewPinChallenge).not.toHaveProperty('updateMany')
  })

  it('rejects one missing member, duplicated claim and any unexpected legacy roster state', async () => {
    m.claims.mockResolvedValue([claim('slot-a'), claim('slot-b')])
    await expect(verify()).rejects.toThrow('exact current roster')
    m.claims.mockResolvedValue([claim('slot-a'), claim('slot-a'), claim('slot-c')])
    await expect(verify()).rejects.toThrow('independently consumed')
    m.claims.mockResolvedValue([claim('slot-a'), claim('slot-b'), claim('old-slot')])
    await expect(verify()).rejects.toThrow('independently consumed')
    m.roster.mockResolvedValue([slots[0], slots[1]])
    await expect(verify()).rejects.toThrow('exact current roster')
    m.roster.mockResolvedValue([{ ...slots[0], crewArrivedAt: now }, slots[1], slots[2]])
    await expect(verify()).rejects.toThrow('exact current roster')
  })

  it('denies stale or invalid challenge versions, issuer, job, purpose, and digest', async () => {
    const invalid = [
      { crewVersion: 6 },
      { jobId: 'other-job' },
      { issuedByCustomerUserId: 'not-customer' },
      { purpose: 'WORK_START' },
      { challengeVersion: 0 },
      { pinDigest: '123456' },
      { revokedAt: new Date() },
      { consumedAt: null },
      { failedAttempts: 5 },
      { consumedAt: new Date(now.getTime() + 300000) },
      { consumedAt: new Date(now.getTime() - 300000) },
      { expiresAt: new Date(now.getTime() - 90000) },
      { lockedUntil: new Date(now.getTime() + 15000) },
    ]
    for (const value of invalid) {
      m.claims.mockResolvedValue([claim('slot-a'), claim('slot-b', value), claim('slot-c')])
      await expect(verify()).rejects.toThrow('independently consumed')
    }
  })

  it('fails before loading PINs if manager or all-worker current identity barrier is stale', async () => {
    m.barrier.mockRejectedValue(new Error('Crew member photo confirmation is missing or stale'))
    await expect(verify()).rejects.toThrow('photo confirmation')
    expect(m.claims).not.toHaveBeenCalled()
  })

  it('does not expose this internal-only inventory through existing crew routes', () => {
    for (const path of [
      'app/api/mobile/v2/jobs/[id]/crew-identity/route.ts',
      'app/api/mobile/worker/crew/route.ts',
      'app/api/mobile/company/crew/evidence/route.ts',
    ]) {
      const src = readFileSync(resolve(process.cwd(), path), 'utf8')
      expect(src).not.toContain('assertAllCrewPinClaimsInsideTransaction')
    }
    const source = readFileSync(resolve(process.cwd(), 'lib/domain/company-crew-pin-claims.ts'), 'utf8')
    expect(source).toContain('physicalPresenceVerified: false')
    expect(source).toContain('workStartEnabled: false')
    expect(source).toContain('arrivalEnabled: false')
  })
})
