import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertCrewDualWitnessInventoryInsideTransaction } from '@/lib/domain/company-crew-presence-witness'

const m = vi.hoisted(() => ({
  claims: vi.fn(), crew: vi.fn(), job: vi.fn(), roster: vi.fn(),
  witnesses: vi.fn(), pins: vi.fn(),
}))
vi.mock('@/lib/domain/company-crew-pin-claims', () => ({
  assertAllCrewPinClaimsInsideTransaction: m.claims,
}))
const tx = {
  companyCrewDispatch: { findUnique: m.crew },
  marketplaceJob: { findUnique: m.job },
  companyJobAssignment: { findMany: m.roster },
  companyCrewPresenceWitness: { findMany: m.witnesses },
  companyCrewPinChallenge: { findMany: m.pins },
}
const version = 5
const now = () => Date.now()
const acceptedSlots = ['alice','bob','charlie'].map((workerUserId, idx) => ({
  id: 'slot-' + idx, workerUserId, status: 'CREW_ACCEPTED',
  startedAt: null, crewArrivedAt: null,
}))
const pins = () => acceptedSlots.map(s => ({
  assignmentId: s.id, revokedAt: null,
  consumedAt: new Date(now()-180000),
  expiresAt: new Date(now()+200000),
}))
const witnesses = () => acceptedSlots.map(s => ({
  id: 'witness-' + s.id,
  assignmentId: s.id, crewDispatchId: 'crew',
  crewVersion: version, jobId: 'booking',
  workerUserId: s.workerUserId, customerUserId: 'customer',
  customerAttestedAt: new Date(now()-150000),
  workerAttestedAt: new Date(now()-160000),
}))
const input = {
  crewDispatchId: 'crew', expectedVersion: version,
  actorUserId: 'manager', actorRole: 'COMPANY_OWNER',
}
const inspect = () => assertCrewDualWitnessInventoryInsideTransaction(tx as any, input)

describe('Phase04 crew dual witness inventory: not a physical arrival or work grant', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.claims.mockResolvedValue({
      crewDispatchId: 'crew', crewVersion: version,
      memberClaimsComplete: true, physicalPresenceVerified: false,
    })
    m.crew.mockResolvedValue({ jobId: 'booking' })
    m.job.mockResolvedValue({ customerId: 'customer' })
    m.roster.mockResolvedValue(acceptedSlots)
    m.witnesses.mockImplementation(witnesses)
    m.pins.mockImplementation(pins)
  })

  it('requires both witnesses from all 3 independent members but returns no arrival or work authority', async () => {
    expect(await inspect()).toEqual({
      crewDispatchId: 'crew', crewVersion: version,
      membersWithDualWitnesses: 3,
      dualAttestationsCollected: true, physicalPresenceVerified: false,
      arrivalEnabled: false, workStartEnabled: false,
    })
    expect(m.claims).toHaveBeenCalledWith(tx, input)
    expect(m.witnesses).toHaveBeenCalledWith({
      where: { crewDispatchId: 'crew', crewVersion: version },
    })
    expect(m.pins).toHaveBeenCalledWith(expect.objectContaining({
      where: { crewDispatchId: 'crew', crewVersion: version, purpose: 'ARRIVAL' },
    }))
    expect(tx.companyCrewPresenceWitness).not.toHaveProperty('update')
    expect(tx).not.toHaveProperty('jobWorkspace')
  })

  it.each([
    ['one missing witness', rows => rows.slice(0, 2)],
    ['duplicate attestation slot', rows => [rows[0], rows[0], rows[2]]],
    ['wrong worker', rows => [rows[0], { ...rows[1], workerUserId: 'attacker' }, rows[2]]],
    ['wrong customer', rows => [rows[0], { ...rows[1], customerUserId: 'attacker' }, rows[2]]],
    ['wrong booking', rows => [rows[0], { ...rows[1], jobId: 'other' }, rows[2]]],
    ['stale epoch', rows => [rows[0], { ...rows[1], crewVersion: version-1 }, rows[2]]],
    ['missing customer acknowledgement', rows => [rows[0], { ...rows[1], customerAttestedAt: null }, rows[2]]],
    ['missing worker acknowledgement', rows => [rows[0], { ...rows[1], workerAttestedAt: null }, rows[2]]],
  ] as Array<[string, (rows: ReturnType<typeof witnesses>) => any[]]>)(
    'refuses %s, never partial group status', async (_label, change) => {
      m.witnesses.mockResolvedValue(change(witnesses()))
      await expect(inspect()).rejects.toThrow()
    },
  )

  it('refuses unconsumed, revoked and duplicated or wrong-member PIN claims', async () => {
    m.pins.mockResolvedValue([{ ...pins()[0], consumedAt: null }, ...pins().slice(1)])
    await expect(inspect()).rejects.toThrow('witness subject')
    m.pins.mockResolvedValue([pins()[0], { ...pins()[1], revokedAt: new Date() }, pins()[2]])
    await expect(inspect()).rejects.toThrow('witness subject')
    m.pins.mockResolvedValue([pins()[0], pins()[0], pins()[2]])
    await expect(inspect()).rejects.toThrow('incomplete')
  })

  it('rejects acknowledgements before PIN consumption or expired/future witnesses', async () => {
    const rows = witnesses()
    m.witnesses.mockResolvedValue([rows[0], {
      ...rows[1], workerAttestedAt: new Date(now()-240000),
    }, rows[2]])
    await expect(inspect()).rejects.toThrow('timing')
    m.witnesses.mockResolvedValue([rows[0], {
      ...rows[1], customerAttestedAt: new Date(now()+60000),
    }, rows[2]])
    await expect(inspect()).rejects.toThrow('timing')
    m.witnesses.mockResolvedValue([rows[0], {
      ...rows[1], customerAttestedAt: new Date(now()-700000),
    }, rows[2]])
    await expect(inspect()).rejects.toThrow('timing')
  })

  it('rejects PIN-claims gate failure before touching witness data', async () => {
    m.claims.mockRejectedValue(new Error('Current worker photo stale'))
    await expect(inspect()).rejects.toThrow('photo stale')
    expect(m.witnesses).not.toHaveBeenCalled()
  })

  it('does not bind inert witness inventory into production routes or treat it as presence', () => {
    const src = (p: string) => readFileSync(resolve(process.cwd(),p),'utf8')
    const s=src('lib/domain/company-crew-presence-witness.ts')
    expect(s).toContain('physicalPresenceVerified: false')
    expect(s).toContain('arrivalEnabled: false')
    expect(s).toContain('workStartEnabled: false')
    for(const path of [
      'app/api/mobile/company/crew/roster/route.ts',
      'app/api/mobile/worker/crew/route.ts',
      'app/api/mobile/v2/jobs/[id]/crew-identity/route.ts',
      'lib/domain/job-pin.ts',
    ]) expect(src(path)).not.toContain('assertCrewDualWitnessInventoryInsideTransaction')
  })
})
