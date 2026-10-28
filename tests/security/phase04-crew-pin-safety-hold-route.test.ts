import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const m=vi.hoisted(()=>({
  actor:'manager' as string|null, suspended:false, enabled:true, allow:true,
  guard:vi.fn(), context:vi.fn(), hold:vi.fn(), tx:vi.fn(), log:vi.fn(),
}))
vi.mock('@/lib/auth/marketplace-auth',()=>({
  authenticateMarketplaceUser:async()=>m.actor?{id:m.actor}:null,
  assertNotSuspended:()=>m.suspended
    ? NextResponse.json({error:'Suspended'},{status:403}):null,
}))
vi.mock('@/lib/domain/company-crew-pin-dev-api-guard',()=>({
  getPhase04CrewPinTestKey:m.guard,
}))
vi.mock('@/lib/phase6/company-context',()=>({
  resolveCompanyContext:m.context,
}))
vi.mock('@/lib/domain/company-crew-pin-safety-hold',()=>({
  holdCrewAfterPinClaimInsideTransaction:m.hold,
}))
vi.mock('@/lib/prisma',()=>({prisma:{$transaction:m.tx}}))
vi.mock('@/lib/shared/observability/secure-console',()=>({
  secureConsole:{error:m.log},
}))
const body={
  companyId:'company',crewDispatchId:'crew',expectedVersion:6,
  reason:'Missing customer after arrival PIN claim',
}
async function post(data:unknown=body, headers:Record<string,string>={}){
  const {POST}=await import('@/app/api/mobile/company/crew/pin-safety-hold/route')
  return POST(new NextRequest('http://localhost/api/mobile/company/crew/pin-safety-hold',{
    method:'POST',headers:{'content-type':'application/json',...headers},
    body:JSON.stringify(data),
  }))
}
describe('Phase04 local-only manager safety containment endpoint (never a work grant)',()=>{
  beforeEach(()=>{
    vi.resetAllMocks()
    m.actor='manager';m.suspended=false
    m.guard.mockReturnValue(Buffer.alloc(32,0x42))
    m.context.mockResolvedValue({context:{companyId:'company',role:'DISPATCHER'}})
    m.tx.mockImplementation(async (fn:(tx:unknown)=>Promise<unknown>)=>fn({token:'tx'}))
    m.hold.mockResolvedValue({
      crewDispatchId:'crew',crewVersion:7,status:'BLOCKED',
      preservedConsumedPinClaims:1,revokedUnusedPinChallenges:1,
      capacityHeldWorkerCount:2,supportReviewRequired:false,
      physicalPresenceVerified:true,arrivalEnabled:true,
      workStartEnabled:true,paymentsEnabled:true,signingKey:'secret',
    })
  })

  it('fails closed before auth/DB unless separate isolated PIN flags and key are present',async()=>{
    m.guard.mockReturnValue(null)
    const response=await post()
    expect(response.status).toBe(409)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(m.context).not.toHaveBeenCalled()
    expect(m.tx).not.toHaveBeenCalled()
    expect(m.hold).not.toHaveBeenCalled()
  })

  it('requires authenticated unrestricted current company dispatcher/owner',async()=>{
    m.actor=null
    expect((await post()).status).toBe(401)
    m.actor='manager';m.suspended=true
    const restricted=await post()
    expect(restricted.status).toBe(403)
    expect(restricted.headers.get('Cache-Control')).toBe('private, no-store')
    m.suspended=false
    m.context.mockResolvedValue({error:NextResponse.json({error:'Forbidden'},{status:403})})
    const forbidden=await post()
    expect(forbidden.status).toBe(403)
    expect(forbidden.headers.get('Cache-Control')).toBe('private, no-store')
    expect(m.tx).not.toHaveBeenCalled()
  })

  it('binds actor and role from auth and current membership within serializable transaction',async()=>{
    const response=await post()
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).toEqual({
      crewDispatchId:'crew',crewVersion:7,status:'BLOCKED',
      preservedConsumedPinClaims:1,revokedUnusedPinChallenges:1,
      capacityHeldWorkerCount:2,supportReviewRequired:true,
      physicalPresenceVerified:false,arrivalEnabled:false,
      workStartEnabled:false,paymentsEnabled:false,
    })
    expect(m.context).toHaveBeenCalledWith('manager','company','workers:assign')
    expect(m.hold).toHaveBeenCalledWith({token:'tx'},{
      companyId:'company',crewDispatchId:'crew',
      expectedVersion:6,actorUserId:'manager',
      actorRole:'DISPATCHER',reason:body.reason,
    })
    expect(m.tx).toHaveBeenCalledWith(expect.any(Function),
      {isolationLevel:'Serializable'})
  })

  it('never allows client to choose actor, worker statuses, job, photos, payment or access rights',async()=>{
    for(const field of [
      'actorRole','actorUserId','workerUserId','workerUserIds',
      'jobId','customerUserId','oldVersion','pin','signingKey',
      'status','capacityHeldWorkerCount','paymentsEnabled',
      'arrivalEnabled','physicalPresenceVerified',
    ]){
      expect((await post({...body,[field]:'spoof'})).status).toBe(400)
    }
    for(const invalid of [
      null,[],{...body,expectedVersion:0},
      {...body,expectedVersion:'6'},
      {...body,reason:''},
      {...body,reason:'x'.repeat(251)},
      {...body,companyId:' '},
    ])expect((await post(invalid)).status).toBe(400)
    expect(m.context).not.toHaveBeenCalled()
    expect(m.tx).not.toHaveBeenCalled()
  })

  it('refuses non-JSON, large request and missing company context without any state mutation',async()=>{
    expect((await post(body,{'content-type':'text/plain'})).status).toBe(415)
    expect((await post(body,{'content-length':'90000'})).status).toBe(400)
    m.context.mockResolvedValue({context:null})
    expect((await post()).status).toBe(403)
    expect(m.tx).not.toHaveBeenCalled()
  })

  it('returns a fail-closed 409 on stale epoch with no leakage',async()=>{
    const {CrewCommitGateError}=await import('@/lib/domain/company-crew-commit-gate')
    m.hold.mockRejectedValue(new CrewCommitGateError('Crew epoch or booking changed'))
    const response=await post()
    expect(response.status).toBe(409)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).not.toHaveProperty('pin')
    expect(m.log).not.toHaveBeenCalled()
  })
})
