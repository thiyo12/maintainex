import { beforeEach, describe, expect, it, vi } from 'vitest'
import { holdCrewAfterPinClaimInsideTransaction } from '@/lib/domain/company-crew-pin-safety-hold'

const m=vi.hoisted(()=>({
  key:vi.fn(), sql:vi.fn(), lock:vi.fn(), slots:vi.fn(),
  legacy:vi.fn(), workspace:vi.fn(), claims:vi.fn(),
  revoke:vi.fn(), update:vi.fn(), audit:vi.fn(), risk:vi.fn(),
}))
vi.mock('@/lib/domain/company-job-assignment',()=>({
  lockAndAssertAssignmentActorAuthorized:m.lock,
}))
vi.mock('@/lib/domain/company-crew-pin-revocation',()=>({
  revokeCrewPinChallengesInsideTransaction:m.revoke,
}))
vi.mock('@/lib/phase6/audit',()=>({writeCompanyAuditLog:m.audit}))
const members=[
  {id:'slot-a',workerUserId:'worker-a',companyId:'company',jobId:'job',
   crewSlot:1,crewRole:'LEAD',status:'CREW_ACCEPTED',startedAt:null,crewArrivedAt:null},
  {id:'slot-b',workerUserId:'worker-b',companyId:'company',jobId:'job',
   crewSlot:2,crewRole:'MEMBER',status:'CREW_ACCEPTED',startedAt:null,crewArrivedAt:null},
]
const job={id:'job',status:'QUOTE_ACCEPTED',workersCount:2}
const crew={id:'crew',companyId:'company',jobId:'job',status:'FORMING',
  version:4,requiredWorkersCount:2,leadWorkerUserId:'worker-a'}
const pins=[
  {id:'pin-a',jobId:'job',assignmentId:'slot-a',purpose:'ARRIVAL',
   consumedAt:new Date(),revokedAt:null},
  {id:'pin-b',jobId:'job',assignmentId:'slot-b',purpose:'ARRIVAL',
   consumedAt:null,revokedAt:null},
]
const tx={
  companyCrewDispatch:{findUnique:m.key,updateMany:m.update},
  companyJobAssignment:{findMany:m.slots},
  jobVerificationPin:{findFirst:m.legacy},
  jobWorkspace:{findUnique:m.workspace},
  companyCrewPinChallenge:{findMany:m.claims},
  marketplaceRiskEvent:{create:m.risk},
  $queryRaw:m.sql,
}
const input={
  crewDispatchId:'crew',companyId:'company',expectedVersion:4,
  actorUserId:'dispatcher',actorRole:'DISPATCHER',reason:'Safety concern',
}
const hold=(patch:Record<string,unknown>={})=>
  holdCrewAfterPinClaimInsideTransaction(tx as any,{...input,...patch})

describe('Phase04 manager safety containment after consumed crew PIN',()=>{
  beforeEach(()=>{
    vi.resetAllMocks()
    m.key.mockResolvedValue({companyId:'company',jobId:'job'})
    m.sql.mockImplementation(async (strings:TemplateStringsArray) =>
      strings.join(' ').includes('MarketplaceJob') ? [job] : [crew])
    m.slots.mockResolvedValue(members)
    m.legacy.mockResolvedValue(null)
    m.workspace.mockResolvedValue(null)
    m.claims.mockResolvedValue(pins)
    m.revoke.mockResolvedValue({revokedPinChallenges:1,consumedClaimsPreserved:1})
    m.update.mockResolvedValue({count:1})
  })

  it('atomically blocks the old epoch while preserving every accepted slot and consumed claim',async()=>{
    expect(await hold()).toEqual({
      crewDispatchId:'crew',crewVersion:5,status:'BLOCKED',
      preservedConsumedPinClaims:1,revokedUnusedPinChallenges:1,
      capacityHeldWorkerCount:2,supportReviewRequired:true,
      physicalPresenceVerified:false,arrivalEnabled:false,
      workStartEnabled:false,paymentsEnabled:false,
    })
    expect(m.lock).toHaveBeenCalledWith(tx,'company','dispatcher','DISPATCHER')
    expect(m.revoke).toHaveBeenCalledWith(tx,{
      crewDispatchId:'crew',crewVersion:4,allowConsumedEvidence:true,
    })
    expect(m.update).toHaveBeenCalledWith({
      where:{id:'crew',status:'FORMING',version:4},
      data:{status:'BLOCKED',version:{increment:1}},
    })
    expect(m.risk).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobId: 'job', actorUserId: 'dispatcher',
        eventType: 'CREW_CONSUMED_PIN_SAFETY_HOLD', severity: 'HIGH',
        metadata: expect.any(String),
      }),
    })
    expect(JSON.parse(m.risk.mock.calls[0][0].data.metadata)).toMatchObject({
      crewDispatchId: 'crew', previousVersion: 4, blockedVersion: 5,
      consumedPinsPreserved: 1, unusedPinsRevoked: 1, capacityHeld: 2,
    })
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({
      companyId:'company',actorId:'dispatcher',
      action:'CREW_PIN_SAFETY_HOLD',
      metadata:expect.objectContaining({
        consumedPinsPreserved:1,unusedPinsRevoked:1,capacityHeld:2,
      }),
    }),tx)
    expect(tx.companyJobAssignment).not.toHaveProperty('updateMany')
    expect(tx.companyCrewPinChallenge).not.toHaveProperty('deleteMany')
  })

  it('rolls back the safety hold when queueing the required HIGH risk event fails', async()=>{
    m.risk.mockRejectedValue(new Error('Safety queue is unavailable'))
    await expect(hold()).rejects.toThrow('Safety queue is unavailable')
    expect(m.update).toHaveBeenCalledOnce()
    expect(m.audit).not.toHaveBeenCalled()
    // A real caller-owned SERIALIZABLE transaction rolls back revocations
    // and the crew version because an unreviewed hold cannot be acknowledged.
  })

  it('denies a removed or unauthenticated manager before any booking lock',async()=>{
    m.lock.mockRejectedValue(new Error('Dispatcher role removed'))
    await expect(hold()).rejects.toThrow('role removed')
    expect(m.sql).not.toHaveBeenCalled()
    expect(m.revoke).not.toHaveBeenCalled()
    expect(m.update).not.toHaveBeenCalled()
  })

  it('denies foreign company before authorizing or revealing booking details',async()=>{
    await expect(hold({companyId:'outside'})).rejects.toThrow('not found')
    expect(m.lock).not.toHaveBeenCalled()
    expect(m.sql).not.toHaveBeenCalled()
  })

  it.each([
    ['blank reason',{reason:' '},'Invalid'],
    ['bad epoch',{expectedVersion:0},'Invalid'],
    ['wrong company',{companyId:''},'Invalid'],
    ['body role missing',{actorRole:''},'Invalid'],
    ['stale version',{expectedVersion:3},'epoch'],
  ])('fails on %s',async(_label,patch,message)=>{
    await expect(hold(patch)).rejects.toThrow(message)
    expect(m.update).not.toHaveBeenCalled()
  })

  it('refuses a crew without a consumed claim, not a general cancellation path',async()=>{
    m.claims.mockResolvedValue([{...pins[0],consumedAt:null},pins[1]])
    await expect(hold()).rejects.toThrow('requires a current consumed')
    expect(m.revoke).not.toHaveBeenCalled()
    expect(m.update).not.toHaveBeenCalled()
  })

  it('denies unrelated, wrong-purpose and missing slot PIN evidence',async()=>{
    for(const bad of [
      {...pins[0],jobId:'unrelated'},
      {...pins[0],assignmentId:'other-slot'},
      {...pins[0],purpose:'WORK_START'},
    ]){
      m.claims.mockResolvedValue([bad,pins[1]])
      await expect(hold()).rejects.toThrow('requires a current consumed')
    }
    expect(m.revoke).not.toHaveBeenCalled()
  })

  it('refuses already started, arrived, workspace, legacy PIN or incomplete roster',async()=>{
    m.slots.mockResolvedValue([members[0],{...members[1],startedAt:new Date()}])
    await expect(hold()).rejects.toThrow('not safe')
    m.slots.mockResolvedValue(members)
    m.workspace.mockResolvedValue({id:'workspace'})
    await expect(hold()).rejects.toThrow('not safe')
    m.workspace.mockResolvedValue(null)
    m.legacy.mockResolvedValue({id:'legacy'})
    await expect(hold()).rejects.toThrow('not safe')
    m.legacy.mockResolvedValue(null)
    m.slots.mockResolvedValue([members[0]])
    await expect(hold()).rejects.toThrow('not safe')
    expect(m.update).not.toHaveBeenCalled()
  })

  it('aborts entire transaction if PIN revocation or version CAS raced',async()=>{
    m.revoke.mockRejectedValue(new Error('PIN challenge changed concurrently'))
    await expect(hold()).rejects.toThrow('changed concurrently')
    expect(m.update).not.toHaveBeenCalled()
    m.revoke.mockResolvedValue({revokedPinChallenges:1,consumedClaimsPreserved:0})
    await expect(hold()).rejects.toThrow('evidence changed')
    m.revoke.mockResolvedValue({revokedPinChallenges:1,consumedClaimsPreserved:1})
    m.update.mockResolvedValue({count:0})
    await expect(hold()).rejects.toThrow('epoch changed')
    expect(m.audit).not.toHaveBeenCalled()
  })
})
