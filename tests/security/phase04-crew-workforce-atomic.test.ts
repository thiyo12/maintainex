import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { blockWorkerFormingCrewsInsideTransaction } from '@/lib/domain/company-crew-workforce'

const m = vi.hoisted(() => ({
  held: vi.fn(), roster: vi.fn(), crew: vi.fn(), sql: vi.fn(),
  arrival: vi.fn(), pin: vi.fn(), release: vi.fn(), block: vi.fn(), audit: vi.fn(), pinRevoke: vi.fn(), risk: vi.fn(), priorClaim: vi.fn(),
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: m.audit }))
vi.mock('@/lib/domain/company-crew-pin-revocation', () => ({
  revokeCrewPinChallengesInsideTransaction: m.pinRevoke,
}))

const slot = (id: string, worker: string, status: string, crewRole: string, crewSlot: number) => ({
  id, workerUserId: worker, companyId: 'company', jobId: 'job', status,
  crewRole, crewSlot, crewArrivedAt: null, startedAt: null,
})
const roster = [slot('s1', 'worker', 'CREW_RESERVED', 'LEAD', 1),
  slot('s2', 'other', 'CREW_ACCEPTED', 'MEMBER', 2)]
const tx = {
  companyJobAssignment: {
    findMany: vi.fn(async (args: any) => 'workerUserId' in args.where
      ? m.held(args) : m.roster(args)),
    updateMany: m.release,
  },
  companyCrewDispatch: { findUnique: m.crew, updateMany: m.block },
  companyCrewPinChallenge: { findFirst: m.priorClaim },
  marketplaceRiskEvent: { create: m.risk },
  jobVerificationPin: { findFirst: vi.fn(async (args: any) =>
    args.where.status === 'ACTIVE' ? m.pin() : m.arrival()) },
  $queryRaw: m.sql,
}
const input = {
  companyId: 'company', workerUserId: 'worker', actorUserId: 'manager',
  actorRole: 'COMPANY_OWNER', reason: 'SUSPENDED' as const,
}
const invalidate = () => blockWorkerFormingCrewsInsideTransaction(tx as any, input)

describe('Phase04 crew workforce invalidation: fail closed and whole-roster atomicity', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.held.mockResolvedValue([{ id: 's1', crewDispatchId: 'crew', jobId: 'job' }])
    m.roster.mockResolvedValue(roster)
    m.crew.mockResolvedValue({ companyId: 'company', jobId: 'job' })
    m.sql.mockResolvedValueOnce([{ id: 'job', status: 'QUOTE_ACCEPTED', workersCount: 2 }])
      .mockResolvedValueOnce([{
        id: 'crew', companyId: 'company', jobId: 'job',
        status: 'FORMING', version: 4, requiredWorkersCount: 2,
        leadWorkerUserId: 'worker',
      }])
    m.arrival.mockResolvedValue(null)
    m.pin.mockResolvedValue(null)
    m.release.mockResolvedValue({ count: 2 })
    m.block.mockResolvedValue({ count: 1 })
    m.pinRevoke.mockResolvedValue({revokedPinChallenges: 0, consumedClaimsPreserved: 0})
    m.priorClaim.mockResolvedValue({id:'prior-pin'})
  })

  it('revokes every reserved/accepted coworker, blocks epoch and audits trigger', async () => {
    expect(await invalidate()).toEqual({ blockedCrewsCount: 1, revokedCrewSlotsCount: 2 })
    expect(m.release).toHaveBeenCalledWith({
      where: { crewDispatchId: 'crew',
        status: { in: ['CREW_RESERVED', 'CREW_ACCEPTED'] } },
      data: { status: 'REVOKED', revokedAt: expect.any(Date),
        revokedReason: 'Crew blocked by workforce suspended' },
    })
    expect(m.block).toHaveBeenCalledWith({
      where: { id: 'crew', version: 4, status: 'FORMING' },
      data: { status: 'BLOCKED', version: { increment: 1 } },
    })
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREW_WORKFORCE_INVALIDATED', actorId: 'manager',
      targetId: 'crew', metadata: expect.objectContaining({
        trigger: 'SUSPENDED', affectedWorkerUserId: 'worker',
        previousVersion: 4, revokedCrewSlots: 2,
      }),
    }), tx)
    expect(tx).not.toHaveProperty('jobWorkspace')
  })

  it('allows a real workforce SUSPENSION with consumed crew PIN: hold all capacity and queue HIGH safety review',async()=>{
    m.roster.mockResolvedValue([
      {...roster[0],status:'CREW_ACCEPTED'},
      roster[1],
    ])
    m.pinRevoke.mockResolvedValue({revokedPinChallenges:1,consumedClaimsPreserved:1})
    expect(await invalidate()).toEqual({blockedCrewsCount:1,revokedCrewSlotsCount:0})
    expect(m.release).not.toHaveBeenCalled()
    expect(m.block).toHaveBeenCalledWith({
      where:{id:'crew',version:4,status:'FORMING'},
      data:{status:'BLOCKED',version:{increment:1}},
    })
    expect(m.pinRevoke).toHaveBeenCalledWith(tx,{
      crewDispatchId:'crew',crewVersion:4,allowConsumedEvidence:true,
    })
    expect(m.risk).toHaveBeenCalledWith({
      data:expect.objectContaining({
        jobId:'job',actorUserId:'manager',
        eventType:'CREW_WORKFORCE_PIN_SAFETY_HOLD',severity:'HIGH',
      }),
    })
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({
      action:'CREW_WORKFORCE_INVALIDATED',
      metadata:expect.objectContaining({
        revokedCrewSlots:0,consumedPinsPreserved:1,unusedPinsRevoked:1,
        capacityHeldForReview:2,
      }),
    }),tx)
  })

  it('allows later role/remove/suspend on already safety-BLOCKED crew without touching capacity or old proof',async()=>{
    m.roster.mockResolvedValue([
      {...roster[0],status:'CREW_ACCEPTED'},roster[1],
    ])
    m.sql.mockReset().mockResolvedValueOnce([{id:'job',status:'QUOTE_ACCEPTED',workersCount:2}])
      .mockResolvedValueOnce([{
        id:'crew',companyId:'company',jobId:'job',status:'BLOCKED',
        version:5,requiredWorkersCount:2,leadWorkerUserId:'worker',
      }])
    expect(await invalidate()).toEqual({blockedCrewsCount:1,revokedCrewSlotsCount:0})
    expect(m.priorClaim).toHaveBeenCalledWith({
      where:{crewDispatchId:'crew',consumedAt:{not:null},purpose:'ARRIVAL'},
      select:{id:true},
    })
    expect(m.pinRevoke).not.toHaveBeenCalled()
    expect(m.release).not.toHaveBeenCalled()
    expect(m.block).not.toHaveBeenCalled()
    expect(m.risk).not.toHaveBeenCalled()
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({
      metadata:expect.objectContaining({
        alreadyBlocked:true,revokedCrewSlots:0,capacityHeldForReview:2,
      }),
    }),tx)
  })

  it('fails closed when a BLOCKED crew has no consumed arrival evidence',async()=>{
    m.roster.mockResolvedValue([
      {...roster[0],status:'CREW_ACCEPTED'},roster[1],
    ])
    m.sql.mockReset().mockResolvedValueOnce([{id:'job',status:'QUOTE_ACCEPTED',workersCount:2}])
      .mockResolvedValueOnce([{
        id:'crew',companyId:'company',jobId:'job',status:'BLOCKED',
        version:5,requiredWorkersCount:2,leadWorkerUserId:'worker',
      }])
    m.priorClaim.mockResolvedValue(null)
    await expect(invalidate()).rejects.toThrow('CREW_WORKFORCE_STATE_CONFLICT')
    expect(m.block).not.toHaveBeenCalled()
    expect(m.release).not.toHaveBeenCalled()
  })

  it('aborts a consumed-PIN workforce transition if the HIGH safety-review event cannot be recorded',async()=>{
    m.roster.mockResolvedValue([
      {...roster[0],status:'CREW_ACCEPTED'},roster[1],
    ])
    m.pinRevoke.mockResolvedValue({revokedPinChallenges:0,consumedClaimsPreserved:1})
    m.risk.mockRejectedValue(new Error('risk queue unavailable'))
    await expect(invalidate()).rejects.toThrow('risk queue unavailable')
    expect(m.block).toHaveBeenCalledOnce()
    expect(m.release).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
    // Real caller SERIALIZABLE transaction rolls back the epoch/write on error.
  })

  it('does not mutate when worker has no staged crew', async () => {
    m.held.mockResolvedValue([])
    expect(await invalidate()).toEqual({ blockedCrewsCount: 0, revokedCrewSlotsCount: 0 })
    expect(m.sql).not.toHaveBeenCalled()
    expect(m.block).not.toHaveBeenCalled()
  })

  it.each([
    ['missing crew key', { crewDispatchId: null }],
    ['stale blocked crew', { crewDispatchId: 'crew' }],
  ])('rejects %s without partial updates', async (name, heldOverride) => {
    if (name === 'missing crew key') m.held.mockResolvedValue([{ id: 's1', ...heldOverride }])
    else m.sql.mockReset().mockResolvedValueOnce([{ id: 'job', status: 'QUOTE_ACCEPTED', workersCount: 2 }])
      .mockResolvedValueOnce([{ id: 'crew', companyId: 'company', jobId: 'job',
        status: 'BLOCKED', version: 5, requiredWorkersCount: 2, leadWorkerUserId: 'worker' }])
    await expect(invalidate()).rejects.toThrow('CREW_WORKFORCE_STATE_CONFLICT')
    expect(m.release).not.toHaveBeenCalled()
    expect(m.block).not.toHaveBeenCalled()
  })

  it.each([
    ['verified arrival', 'arrival'],
    ['active PIN', 'pin'],
    ['started worker', 'started'],
    ['missing coworker', 'missing'],
    ['duplicate slot', 'duplicate'],
  ])('refuses %s rather than silently removing a worker', async (_name, kind) => {
    if (kind === 'arrival') m.arrival.mockResolvedValue({ id: 'arrival' })
    if (kind === 'pin') m.pin.mockResolvedValue({ id: 'pin' })
    if (kind === 'started') m.roster.mockResolvedValue([{ ...roster[0], startedAt: new Date() }, roster[1]])
    if (kind === 'missing') m.roster.mockResolvedValue([roster[0]])
    if (kind === 'duplicate') m.roster.mockResolvedValue([roster[0], { ...roster[1], crewSlot: 1 }])
    await expect(invalidate()).rejects.toThrow('CREW_WORKFORCE_STATE_CONFLICT')
    expect(m.release).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
  })

  it('aborts if conditional release loses an acceptance race; no terminal marker written', async () => {
    m.release.mockResolvedValue({ count: 1 })
    await expect(invalidate()).rejects.toThrow('CREW_WORKFORCE_STATE_CONFLICT')
    expect(m.block).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
  })

  it('aborts on stale crew version after releasing slots, requiring transaction rollback', async () => {
    m.block.mockResolvedValue({ count: 0 })
    await expect(invalidate()).rejects.toThrow('CREW_WORKFORCE_STATE_CONFLICT')
    expect(m.audit).not.toHaveBeenCalled()
  })
})

describe('Phase04 workforce API integration contracts', () => {
  const source = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
  it('ties role-change and suspension to the crew helper inside SERIALIZABLE writes', () => {
    const s = source('app/api/mobile/company/workforce/route.ts')
    expect(s).toContain('blockWorkerFormingCrewsInsideTransaction(tx, {')
    expect(s).toContain("reason: 'ROLE_CHANGED'")
    expect(s).toContain("reason: 'SUSPENDED'")
    expect(s.split('Prisma.TransactionIsolationLevel.Serializable').length - 1).toBeGreaterThanOrEqual(2)
    expect(s).toContain("err.message === 'CREW_WORKFORCE_STATE_CONFLICT'")
    expect(s).toContain("code === 'P2034'")
  })
  it('uses the same atomic helper for removal, never just revokes departing member', () => {
    const s = source('app/api/mobile/company/team/[id]/route.ts')
    expect(s).toContain("reason: 'REMOVED'")
    expect(s).toContain('blockWorkerFormingCrewsInsideTransaction(tx, {')
    expect(s).toContain('Prisma.TransactionIsolationLevel.Serializable')
    expect(s).toContain("error.message === 'CREW_WORKFORCE_STATE_CONFLICT'")
  })
})
