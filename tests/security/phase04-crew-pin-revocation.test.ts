import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { revokeCrewPinChallengesInsideTransaction } from '@/lib/domain/company-crew-pin-revocation'

const m = vi.hoisted(() => ({ scan: vi.fn(), update: vi.fn() }))
vi.mock('@/lib/domain/company-crew-commit-gate', () => ({
  CrewCommitGateError: class CrewCommitGateError extends Error {
    constructor(message: string, public readonly status = 409) { super(message) }
  },
}))
const tx = { companyCrewPinChallenge: { findMany: m.scan, updateMany: m.update } }
const input = { crewDispatchId: 'crew', crewVersion: 3 }
const run = (extra: Record<string, unknown> = {}) =>
  revokeCrewPinChallengesInsideTransaction(tx as any, { ...input, ...extra })
const entry = (id: string, patch: Record<string, unknown> = {}) => ({
  id, crewVersion: 3, consumedAt: null, revokedAt: null, ...patch,
})

describe('Phase04 crew cancellation/role change PIN ledger safety', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.scan.mockResolvedValue([entry('a'), entry('b'), entry('c')])
    m.update.mockResolvedValue({ count: 3 })
  })

  it('revokes ALL three unconsumed member PINs in the caller transaction', async () => {
    expect(await run()).toEqual({
      revokedPinChallenges: 3, consumedClaimsPreserved: 0,
    })
    expect(m.scan).toHaveBeenCalledWith({
      where: { crewDispatchId: 'crew' },
      select: { id: true, crewVersion: true, consumedAt: true, revokedAt: true },
    })
    expect(m.update).toHaveBeenCalledWith({
      where: {
        id: { in: ['a', 'b', 'c'] }, crewDispatchId: 'crew',
        crewVersion: 3, consumedAt: null, revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    })
    expect(tx).not.toHaveProperty('jobWorkspace')
  })

  it('does not permit routine removal after even one worker consumed a PIN', async () => {
    m.scan.mockResolvedValue([
      entry('a'), entry('b', { consumedAt: new Date() }), entry('c'),
    ])
    await expect(run()).rejects.toThrow('requires support review')
    expect(m.update).not.toHaveBeenCalled()
  })

  it('safety mismatch retains consumed evidence while withdrawing all still-live codes', async () => {
    m.scan.mockResolvedValue([
      entry('a', { consumedAt: new Date() }),
      entry('b'), entry('c', { revokedAt: new Date() }),
    ])
    m.update.mockResolvedValue({ count: 1 })
    expect(await run({ allowConsumedEvidence: true })).toEqual({
      revokedPinChallenges: 1, consumedClaimsPreserved: 1,
    })
    expect(m.update).toHaveBeenCalledWith({
      where: {
        id: { in: ['b'] }, crewDispatchId: 'crew',
        crewVersion: 3, consumedAt: null, revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    })
  })

  it('refuses ordinary cancellation when consumed evidence survives an older crew epoch', async () => {
    m.scan.mockResolvedValue([
      entry('prior-claim', { crewVersion: 2, consumedAt: new Date() }),
      entry('current-live', { crewVersion: 3 }),
    ])
    await expect(run()).rejects.toThrow('requires support review')
    expect(m.update).not.toHaveBeenCalled()
  })

  it('holds all historical consumed evidence but only revokes unused current-epoch challenges', async () => {
    m.scan.mockResolvedValue([
      entry('prior-claim-1', { crewVersion: 1, consumedAt: new Date() }),
      entry('prior-claim-2', { crewVersion: 2, consumedAt: new Date() }),
      entry('old-live', { crewVersion: 2 }),
      entry('current-live', { crewVersion: 3 }),
    ])
    m.update.mockResolvedValue({ count: 1 })
    expect(await run({ allowConsumedEvidence: true })).toEqual({
      revokedPinChallenges: 1, consumedClaimsPreserved: 2,
    })
    expect(m.update).toHaveBeenCalledWith({
      where: {
        id: { in: ['current-live'] }, crewDispatchId: 'crew',
        crewVersion: 3, consumedAt: null, revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    })
  })

  it('aborts whole-crew transition on a missing conditional PIN row', async () => {
    m.update.mockResolvedValue({ count: 2 })
    await expect(run()).rejects.toThrow('changed concurrently')
  })

  it('is safe before issuance and refuses stale invalid epoch scope', async () => {
    m.scan.mockResolvedValue([])
    expect(await run()).toEqual({ revokedPinChallenges: 0, consumedClaimsPreserved: 0 })
    expect(m.update).not.toHaveBeenCalled()
    await expect(run({ crewVersion: 0 })).rejects.toMatchObject({ status: 400 })
    await expect(run({ crewDispatchId: '' })).rejects.toMatchObject({ status: 400 })
  })

  it('every normal crew terminal path shares the helper, while safety mismatch can escalate', () => {
    const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
    const lifecycle = read('lib/domain/company-crew-lifecycle.ts')
    expect(lifecycle.split('await revokeCrewPinChallengesInsideTransaction(tx, {').length - 1).toBe(2)
    const workforce = read('lib/domain/company-crew-workforce.ts')
    expect(workforce).toContain('await revokeCrewPinChallengesInsideTransaction(tx, {')
    const safety = read('lib/domain/company-crew-identity.ts')
    expect(safety).toContain('allowConsumedEvidence: true')
    expect(read('lib/domain/job-pin.ts')).toContain('Multi-worker jobs require crew-specific PIN verification')
  })
})
