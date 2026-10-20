import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { recordCrewPresenceWitnessInsideTransaction } from '@/lib/domain/company-crew-presence-record'

const m = vi.hoisted(() => ({
  key: vi.fn(), sql: vi.fn(), company: vi.fn(), companyEligible: vi.fn(),
  market: vi.fn(), candidate: vi.fn(), schedule: vi.fn(),
  slots: vi.fn(), photo: vi.fn(), confirmed: vi.fn(),
  legacy: vi.fn(), safety: vi.fn(), pins: vi.fn(),
  witness: vi.fn(), create: vi.fn(), update: vi.fn(), audit: vi.fn(),
}))
vi.mock('@/lib/domain/company-crew-commit-gate', () => ({
  CrewCommitGateError: class CrewCommitGateError extends Error {
    constructor(message: string, public readonly status = 409) { super(message) }
  },
}))
vi.mock('@/lib/phase6/provider-eligibility', () => ({
  checkCompanyEligibility: m.companyEligible,
  checkCrewCandidateEligibility: m.candidate,
}))
vi.mock('@/lib/geography/market-engine', () => ({ requireJobMarket: m.market }))
vi.mock('@/lib/domain/company-job-assignment', () => ({
  lockAndAssertWorkerScheduleAvailable: m.schedule,
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: m.audit }))

const confirmedAt = new Date(Date.now()-300000)
const acceptedAt = new Date(confirmedAt.getTime()-1000)
const roster = ['worker-a','worker-b','worker-c'].map((workerUserId,i)=>({
  id:'slot-'+i,companyId:'company',jobId:'job',workerUserId,
  status:'CREW_ACCEPTED',crewSlot:i+1,crewRole:i===0?'LEAD':'MEMBER',
  acceptedAt,crewIdentityConfirmedAt:confirmedAt,
  crewArrivedAt:null,startedAt:null,
}))
const claimRows = () => roster.map(s=>({
  id:'pin-'+s.id,assignmentId:s.id,jobId:'job',crewVersion:9,
  issuedByCustomerUserId:'customer',purpose:'ARRIVAL',
  createdAt:new Date(Date.now()-230000),
  consumedAt:new Date(Date.now()-190000),
  expiresAt:new Date(Date.now()+270000),
  revokedAt:null,failedAttempts:0,lockedUntil:null,
}))
const job = {
  id:'job',customerId:'customer',status:'QUOTE_ACCEPTED',workersCount:3,
  countryCode:'LK',latitude:null,longitude:null,targetTaskerId:null,
  preferredDate:null,preferredTimeSlot:null,
}
const crew = {
  id:'crew',companyId:'company',jobId:'job',status:'FORMING',version:9,
  requiredWorkersCount:3,leadWorkerUserId:'worker-a',
}
const tx = {
  companyCrewDispatch:{findUnique:m.key},
  companyProfile:{findUnique:m.company},
  companyJobAssignment:{findMany:m.slots},
  companyCrewPinChallenge:{findMany:m.pins},
  companyCrewPresenceWitness:{findFirst:m.witness,create:m.create,updateMany:m.update},
  jobVerificationPin:{findFirst:m.legacy},
  jobWorkerIdentityCheck:{findFirst:m.safety,findUnique:m.confirmed},
  providerIdentity:{findFirst:m.photo},
  $queryRaw:m.sql,
}
const request = (overrides:Record<string,unknown>={}) => ({
  crewDispatchId:'crew',expectedVersion:9,
  assignmentId:'slot-0',authenticatedUserId:'worker-a',
  participant:'WORKER' as const,...overrides,
})
const record = (overrides:Record<string,unknown>={})=>
  recordCrewPresenceWitnessInsideTransaction(tx as any,request(overrides) as any)

describe('Phase04 individual witness recording: mutually independent actors, no live presence',()=>{
  beforeEach(()=>{
    vi.resetAllMocks()
    m.key.mockResolvedValue({companyId:'company',jobId:'job'})
    m.sql.mockImplementation(async (strings:TemplateStringsArray,...args:unknown[])=>{
      const sql=strings.join(' ')
      if(sql.includes('FROM "JobQuote"')) return [{id:'quote'}]
      if(sql.includes('FROM "MarketplaceJob"')) return [job]
      if(sql.includes('FROM "CompanyCrewDispatch"')) return [crew]
      if(sql.includes('FROM "User"')) return [{
        id:args[0],isActive:true,isSuspended:false,isBanned:false,
      }]
      throw new Error('Unexpected SQL '+sql)
    })
    m.company.mockResolvedValue({countryCode:'LK',userId:'founder'})
    m.market.mockReturnValue({ok:true,countryCode:'LK'})
    m.companyEligible.mockResolvedValue({eligible:true})
    m.candidate.mockResolvedValue({eligible:true})
    m.slots.mockResolvedValue(roster)
    m.pins.mockImplementation(claimRows)
    m.legacy.mockResolvedValue(null)
    m.safety.mockResolvedValue(null)
    m.photo.mockImplementation(async (args:any)=>({
      id:'photo-'+args.where.currentUserId,verifiedPhotoUrl:'/verified',
    }))
    m.confirmed.mockImplementation(async (args:any)=>({
      status:'MATCHED',
      assignedWorkerUserId:args.where.jobId_providerIdentityId.providerIdentityId.slice(6),
      photoSnapshotUrl:'/verified',confirmedAt,
    }))
    m.witness.mockResolvedValue(null)
    m.create.mockResolvedValue({id:'witness'})
    m.update.mockResolvedValue({count:1})
  })

  it('records only a worker’s own side after all 3 PIN/photo checks and audits no-authority receipt',async()=>{
    const r=await record()
    expect(r).toEqual({
      crewDispatchId:'crew',crewVersion:9,assignmentId:'slot-0',
      participantRecorded:'WORKER',physicalPresenceVerified:false,
      arrivalEnabled:false,workStartEnabled:false,
    })
    expect(m.create).toHaveBeenCalledWith({data:expect.objectContaining({
      crewDispatchId:'crew',crewVersion:9,assignmentId:'slot-0',
      workerUserId:'worker-a',customerUserId:'customer',
      workerAttestedAt:expect.any(Date),
    })})
    expect(m.create.mock.calls[0][0].data).not.toHaveProperty('customerAttestedAt')
    expect(m.schedule).toHaveBeenCalledTimes(3)
    expect(m.candidate).toHaveBeenCalledTimes(3)
    expect(m.confirmed).toHaveBeenCalledTimes(3)
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({
      action:'CREW_PRESENCE_ACKNOWLEDGED',actorId:'worker-a',
      metadata:expect.objectContaining({
        assignmentId:'slot-0',participant:'WORKER',
        physicalPresenceVerified:false,
      }),
    }),tx)
    expect(tx).not.toHaveProperty('marketplaceJob')
    expect(tx).not.toHaveProperty('jobWorkspace')
  })

  it('customer records only their own side on a worker’s exact assignment',async()=>{
    await record({participant:'CUSTOMER',authenticatedUserId:'customer',assignmentId:'slot-1'})
    expect(m.create.mock.calls[0][0].data).toMatchObject({
      workerUserId:'worker-b',customerUserId:'customer',
      customerAttestedAt:expect.any(Date),
    })
    expect(m.create.mock.calls[0][0].data).not.toHaveProperty('workerAttestedAt')
  })

  it('only adds missing independent side without changing earlier witness',async()=>{
    m.witness.mockResolvedValue({
      id:'w1',jobId:'job',workerUserId:'worker-a',customerUserId:'customer',
      workerAttestedAt:new Date(),customerAttestedAt:null,
    })
    await record({participant:'CUSTOMER',authenticatedUserId:'customer'})
    expect(m.update).toHaveBeenCalledWith({
      where:expect.objectContaining({
        id:'w1',crewVersion:9,assignmentId:'slot-0',
        customerAttestedAt:null,customerUserId:'customer',
      }),
      data:{customerAttestedAt:expect.any(Date)},
    })
    expect(m.create).not.toHaveBeenCalled()
  })

  it('rejects duplicate attestation and conditional update race without audit',async()=>{
    m.witness.mockResolvedValue({
      id:'w1',jobId:'job',customerUserId:'customer',
      workerUserId:'worker-a',workerAttestedAt:new Date(),customerAttestedAt:null,
    })
    await expect(record()).rejects.toThrow('already recorded')
    expect(m.update).not.toHaveBeenCalled()
    m.update.mockResolvedValue({count:0})
    await expect(record({participant:'CUSTOMER',authenticatedUserId:'customer'}))
      .rejects.toThrow('concurrently')
    expect(m.audit).not.toHaveBeenCalled()
  })

  it('rejects spoofed customer, coworker or absent assignment before recording',async()=>{
    await expect(record({participant:'CUSTOMER',authenticatedUserId:'worker-a'}))
      .rejects.toMatchObject({status:404})
    await expect(record({authenticatedUserId:'worker-b'}))
      .rejects.toMatchObject({status:404})
    await expect(record({assignmentId:'slot-outsider'}))
      .rejects.toMatchObject({status:404})
    expect(m.create).not.toHaveBeenCalled()
  })

  it('fails closed for restricted session, obsolete epoch, legacy arrival or safety hold',async()=>{
    m.sql.mockImplementationOnce(async()=>[{id:'quote'}])
      .mockImplementationOnce(async()=>[job])
      .mockImplementationOnce(async()=>[{...crew,version:10}])
    await expect(record()).rejects.toThrow('epoch')
    m.legacy.mockResolvedValue({id:'legacy-arrival'})
    await expect(record()).rejects.toThrow('safety evidence')
    m.legacy.mockResolvedValue(null)
    m.safety.mockResolvedValue({id:'unresolved-mismatch'})
    await expect(record()).rejects.toThrow('safety evidence')
    expect(m.create).not.toHaveBeenCalled()
  })

  it('rejects under-staffing, withdrawn member identity and stale PIN claims',async()=>{
    m.slots.mockResolvedValue(roster.slice(0,2))
    await expect(record()).rejects.toThrow('Complete accepted crew')
    m.slots.mockResolvedValue(roster)
    m.confirmed.mockResolvedValue({status:'REVIEW_REQUIRED'})
    await expect(record()).rejects.toThrow('photo approval changed')
    m.confirmed.mockImplementation(async (args:any)=>({
      status:'MATCHED',
      assignedWorkerUserId:args.where.jobId_providerIdentityId.providerIdentityId.slice(6),
      photoSnapshotUrl:'/verified',confirmedAt,
    }))
    m.pins.mockResolvedValue([{...claimRows()[0],consumedAt:null},...claimRows().slice(1)])
    await expect(record()).rejects.toThrow('PIN evidence')
    expect(m.create).not.toHaveBeenCalled()
  })

  it('is disabled in production and unreachable from existing customer/worker routes',async()=>{
    vi.stubEnv('NODE_ENV','production')
    try{
      await expect(record()).rejects.toThrow('not enabled')
      expect(m.sql).not.toHaveBeenCalled()
    } finally { vi.unstubAllEnvs() }
    const src=(p:string)=>readFileSync(resolve(process.cwd(),p),'utf8')
    const own=src('lib/domain/company-crew-presence-record.ts')
    expect(own).toContain('physicalPresenceVerified: false')
    expect(own).toContain('arrivalEnabled: false')
    expect(own).toContain('workStartEnabled: false')
    for(const p of [
      'app/api/mobile/company/crew/roster/route.ts',
      'app/api/mobile/worker/crew/route.ts',
      'app/api/mobile/v2/jobs/[id]/crew-identity/route.ts',
      'lib/domain/job-pin.ts',
    ]) expect(src(p)).not.toContain('recordCrewPresenceWitnessInsideTransaction')
  })
})
