import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const m = vi.hoisted(() => ({
  user: 'customer' as string | null,
  blocked: false,
  booking: vi.fn(), crew: vi.fn(), slot: vi.fn(),
  issue: vi.fn(), consume: vi.fn(), transaction: vi.fn(), log: vi.fn(),
}))
vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => m.user ? { id: m.user } : null,
  assertNotSuspended: () => m.blocked
    ? NextResponse.json({ error: 'Suspended' }, { status: 403 }) : null,
}))
vi.mock('@/lib/domain/company-crew-pin-issue', () => ({
  issueStagedCrewArrivalPinsInsideTransaction: m.issue,
}))
vi.mock('@/lib/domain/company-crew-pin-consume', () => ({
  consumeStagedCrewMemberPinInsideTransaction: m.consume,
}))
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: m.transaction } }))
vi.mock('@/lib/shared/observability/secure-console', () => ({
  secureConsole: { error: m.log },
}))

const tx = {
  marketplaceJob: { findFirst: m.booking },
  companyCrewDispatch: { findFirst: m.crew },
  companyJobAssignment: { findFirst: m.slot },
}
const params = { params: Promise.resolve({ id: 'job' }) }
async function post(action: 'issue'|'verify', body: unknown, headers: Record<string,string> = {}) {
  const route = action === 'issue'
    ? await import('@/app/api/mobile/v2/jobs/[id]/crew-pin/issue/route')
    : await import('@/app/api/mobile/v2/jobs/[id]/crew-pin/verify/route')
  return route.POST(new NextRequest('http://localhost/api/mobile/v2/jobs/job/crew-pin/' + action, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }), params)
}
const request = { crewDispatchId: 'crew', expectedVersion: 7 }
const workerRequest = { ...request, pin: '012345' }
const key = Buffer.alloc(32, 0x3e).toString('hex')

describe('Phase04 isolated dev PIN issuance and worker-only verification', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('DATABASE_URL',
      'postgresql://isolated_user:isolated_password@127.0.0.1:5432/maintainex_test_phase07_ci')
    vi.stubEnv('MAINTAINEX_PHASE04_CREW_WITNESS_TEST_ENABLED','true')
    vi.stubEnv('MAINTAINEX_PHASE04_CREW_PIN_TEST_ENABLED','true')
    vi.stubEnv('MAINTAINEX_PHASE04_CREW_PIN_TEST_KEY_HEX',key)
    m.user = 'customer'
    m.blocked = false
    m.booking.mockResolvedValue({ id:'job' })
    m.crew.mockResolvedValue({ id:'crew' })
    m.slot.mockResolvedValue(null)
    m.transaction.mockImplementation(async (fn: (tx:unknown)=>Promise<unknown>) => fn(tx))
    m.issue.mockResolvedValue({
      crewDispatchId:'crew',crewVersion:7,
      memberCodes:[{assignmentId:'slot-a',pin:'012345'},{assignmentId:'slot-b',pin:'654321'}],
      arrivalEnabled:true,workStartEnabled:true,
    })
    m.consume.mockResolvedValue({
      pinVerified:true,attemptsRemaining:0,arrivalEnabled:true,workStartEnabled:true,
    })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('issues distinct customer-only PINs scoped to URL booking, with false authority flags', async()=>{
    const res=await post('issue',request)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await res.json()).toEqual({
      crewDispatchId:'crew', crewVersion:7,
      memberCodes:[{assignmentId:'slot-a',pin:'012345'},{assignmentId:'slot-b',pin:'654321'}],
      arrivalEnabled:false,workStartEnabled:false,
    })
    expect(m.booking).toHaveBeenCalledWith({
      where:{id:'job',customerId:'customer'},select:{id:true},
    })
    expect(m.issue).toHaveBeenCalledWith(tx, {
      crewDispatchId:'crew',expectedVersion:7,
      authenticatedCustomerUserId:'customer',signingKey:Buffer.from(key,'hex'),
    })
    expect(m.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel:'Serializable',
    })
    expect(m.log).not.toHaveBeenCalled()
  })

  it('worker identity comes only from their session/current accepted assignment, not body',async()=>{
    m.user='worker-a'
    m.slot.mockResolvedValue({id:'slot-a'})
    m.consume.mockResolvedValue({pinVerified:true,attemptsRemaining:0})
    const res=await post('verify',workerRequest)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      pinVerified:true, attemptsRemaining:0, arrivalEnabled:false, workStartEnabled:false,
    })
    expect(m.slot).toHaveBeenCalledWith({
      where:{crewDispatchId:'crew',jobId:'job',workerUserId:'worker-a',status:'CREW_ACCEPTED'},
      select:{id:true},
    })
    expect(m.consume).toHaveBeenCalledWith(tx,{
      crewDispatchId:'crew',expectedVersion:7,authenticatedWorkerUserId:'worker-a',
      purpose:'ARRIVAL', pin:'012345',signingKey:Buffer.from(key,'hex'),
    })
    expect(m.issue).not.toHaveBeenCalled()
  })

  it('failed PIN attempt result is returned normally to preserve transaction throttle',async()=>{
    m.user='worker-a'
    m.slot.mockResolvedValue({id:'slot-a'})
    m.consume.mockResolvedValue({pinVerified:false,attemptsRemaining:3})
    const res=await post('verify',workerRequest)
    expect(res.status).toBe(200)
    const json=await res.json()
    expect(json).toMatchObject({pinVerified:false,attemptsRemaining:3})
    expect(json).not.toHaveProperty('pin')
    expect(json).not.toHaveProperty('signingKey')
    expect(m.transaction).toHaveBeenCalledOnce()
  })

  it('both routes fail CLOSED in production, without both opt-ins, wrong DB or missing signing key',async()=>{
    for(const [name,value] of [
      ['NODE_ENV','production'],
      ['MAINTAINEX_PHASE04_CREW_PIN_TEST_ENABLED','false'],
      ['MAINTAINEX_PHASE04_CREW_PIN_TEST_KEY_HEX','short'],
      ['MAINTAINEX_PHASE04_CREW_WITNESS_TEST_ENABLED','false'],
      ['DATABASE_URL','postgresql://user:pass@remote.example/maintainex_test_phase07_ci'],
    ] as const){
      vi.stubEnv(name,value)
      for(const action of ['issue','verify'] as const){
        expect((await post(action,action==='issue'?request:workerRequest)).status).toBe(409)
      }
      // Restore environment across test cases to isolate each condition.
      vi.stubEnv('NODE_ENV','test')
      vi.stubEnv('MAINTAINEX_PHASE04_CREW_PIN_TEST_ENABLED','true')
      vi.stubEnv('MAINTAINEX_PHASE04_CREW_PIN_TEST_KEY_HEX',key)
      vi.stubEnv('MAINTAINEX_PHASE04_CREW_WITNESS_TEST_ENABLED','true')
      vi.stubEnv('DATABASE_URL',
        'postgresql://isolated_user:isolated_password@127.0.0.1:5432/maintainex_test_phase07_ci')
    }
    expect(m.transaction).not.toHaveBeenCalled()
  })

  it('refuses unauthenticated/blocked customer and worker before DB or PIN activity',async()=>{
    m.user=null
    expect((await post('issue',request)).status).toBe(401)
    expect((await post('verify',workerRequest)).status).toBe(401)
    m.user='customer'
    m.blocked=true
    expect((await post('issue',request)).status).toBe(403)
    expect((await post('verify',workerRequest)).status).toBe(403)
    expect(m.transaction).not.toHaveBeenCalled()
  })

  it('rejects guessed booking/crew and coworker verification without exposing codes',async()=>{
    m.booking.mockResolvedValue(null)
    expect((await post('issue',request)).status).toBe(404)
    expect(m.issue).not.toHaveBeenCalled()
    m.user='coworker'
    m.slot.mockResolvedValue(null)
    expect((await post('verify',workerRequest)).status).toBe(404)
    expect(m.consume).not.toHaveBeenCalled()
    m.crew.mockResolvedValue(null)
    expect((await post('verify',workerRequest)).status).toBe(404)
  })

  it('refuses body-selected role, identity, booking, signing key, purpose and authority',async()=>{
    for(const field of ['authenticatedWorkerUserId','workerUserId','customerUserId',
      'actorRole','participant','purpose','signingKey','jobId',
      'arrivalEnabled','workStartEnabled','status','assignmentId']){
      expect((await post('issue',{...request,[field]:'attacker'})).status).toBe(400)
      expect((await post('verify',{...workerRequest,[field]:'attacker'})).status).toBe(400)
    }
    for(const invalid of [{...request,expectedVersion:0},{...request,expectedVersion:'7'},
      {...request,crewDispatchId:''}]){
      expect((await post('issue',invalid)).status).toBe(400)
    }
    for(const invalid of [
      {...workerRequest,pin:123456},
      {...workerRequest,pin:'12345'},
      {...workerRequest,pin:'1234567'},
      {...workerRequest,pin:'abcdef'},
    ]) expect((await post('verify',invalid)).status).toBe(400)
    expect(m.transaction).not.toHaveBeenCalled()
  })

  it('rejects non-JSON and overlong declared request bodies',async()=>{
    for(const action of ['issue','verify'] as const){
      const payload=action==='issue'?request:workerRequest
      expect((await post(action,payload,{'content-type':'text/plain'})).status).toBe(415)
      expect((await post(action,payload,{'content-length':'150000'})).status).toBe(400)
    }
    expect(m.transaction).not.toHaveBeenCalled()
  })
})
