import { beforeEach, describe, expect, it, vi } from 'vitest'
import { issueStagedCrewArrivalPinInsideTransaction } from '@/lib/domain/company-crew-pin-issue'
const m = vi.hoisted(() => ({
  sql: vi.fn(), key: vi.fn(), slots: vi.fn(), company: vi.fn(),
  schedule: vi.fn(), candidate: vi.fn(), photo: vi.fn(), confirmation: vi.fn(),
  pin: vi.fn(), mismatch: vi.fn(), existing: vi.fn(), create: vi.fn(),
}))
vi.mock('@/lib/phase6/provider-eligibility', () => ({
  checkCompanyEligibility: m.company, checkCrewCandidateEligibility: m.candidate,
}))
vi.mock('@/lib/domain/company-job-assignment', () => ({
  lockAndAssertWorkerScheduleAvailable: m.schedule,
}))
const tx = {
  companyCrewDispatch: { findUnique: m.key },
  $queryRaw: m.sql,
  jobVerificationPin: { findFirst: m.pin },
  jobWorkerIdentityCheck: { findFirst: m.mismatch, findUnique: m.confirmation },
  companyJobAssignment: { findMany: m.slots },
  providerIdentity: { findFirst: m.photo },
  companyCrewPinChallenge: { findFirst: m.existing, create: m.create },
}
const now = new Date('2026-10-20T10:00:00.000Z')
const job = { id: 'job', status: 'QUOTE_ACCEPTED', workersCount: 2,
  customerId: 'customer', preferredDate: null, preferredTimeSlot: null }
const crew = { id: 'crew', companyId: 'company', jobId: 'job',
  status: 'FORMING', version: 2, requiredWorkersCount: 2, leadWorkerUserId: 'worker-a' }
const slots = ['worker-a','worker-b'].map((workerUserId,i) => ({
  id: 'slot-'+i, companyId: 'company', jobId: 'job', workerUserId,
  status: 'CREW_ACCEPTED', crewSlot: i+1, crewRole: i===0?'LEAD':'MEMBER',
  acceptedAt: now, crewIdentityConfirmedAt: new Date(now.getTime()+1000),
  crewArrivedAt: null, startedAt: null,
}))
const input = () => ({
  crewDispatchId: 'crew', expectedVersion: 2,
  authenticatedCustomerUserId: 'customer', assignmentId: 'slot-0',
  signingKey: Buffer.alloc(32, 0x37),
})
const issue = () => issueStagedCrewArrivalPinInsideTransaction(tx as any, input())

describe('Phase04 internal per-member customer-owned PIN issuance — no arrival activation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.key.mockResolvedValue({ companyId: 'company', jobId: 'job' })
    m.sql.mockResolvedValueOnce([{ id: 'quote' }]).mockResolvedValueOnce([job])
      .mockResolvedValueOnce([crew])
    m.slots.mockResolvedValue(slots)
    m.company.mockResolvedValue({ eligible: true })
    m.candidate.mockResolvedValue({ eligible: true })
    m.photo.mockImplementation(async (arg: any) => ({
      id: 'photo-'+arg.where.currentUserId, verifiedPhotoUrl: '/approved',
    }))
    m.confirmation.mockImplementation(async (arg: any) => ({
      status: 'MATCHED', assignedWorkerUserId:
        arg.where.jobId_providerIdentityId.providerIdentityId.replace('photo-',''),
      photoSnapshotUrl: '/approved', confirmedAt: new Date(now.getTime()+1000),
    }))
    m.pin.mockResolvedValue(null)
    m.mismatch.mockResolvedValue(null)
    m.existing.mockResolvedValue(null)
    m.create.mockResolvedValue({ id: 'challenge' })
  })

  it('rechecks every accepted member and only persists an HMAC (not plaintext)', async () => {
    const result = await issue()
    expect(result.pin).toMatch(/^[1-9][0-9]{5}$/)
    expect(result).toMatchObject({ challengeId: 'challenge',
      crewVersion: 2, arrivalEnabled: false, workStartEnabled: false })
    expect(m.schedule).toHaveBeenCalledTimes(2)
    expect(m.candidate).toHaveBeenCalledTimes(2)
    expect(m.photo).toHaveBeenCalledTimes(2)
    expect(m.confirmation).toHaveBeenCalledTimes(2)
    const saved = m.create.mock.calls[0][0].data
    expect(saved).toMatchObject({ crewDispatchId: 'crew', jobId: 'job',
      assignmentId: 'slot-0', crewVersion: 2, issuedByCustomerUserId: 'customer',
      purpose: 'ARRIVAL' })
    expect(saved.pinDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(saved.pinDigest).not.toBe(result.pin)
    expect(saved).not.toHaveProperty('pin')
    expect(tx).not.toHaveProperty('marketplaceJob')
    expect(tx).not.toHaveProperty('jobWorkspace')
  })

  it('denies another customer before disclosing or writing crew challenges', async () => {
    m.sql.mockReset().mockResolvedValueOnce([{ id: 'quote' }])
      .mockResolvedValueOnce([job])
    const wrong = { ...input(), authenticatedCustomerUserId: 'attacker' }
    await expect(issueStagedCrewArrivalPinInsideTransaction(tx as any, wrong))
      .rejects.toMatchObject({ status: 404 })
    expect(m.create).not.toHaveBeenCalled()
  })

  it('rejects epoch changes, identity mismatch and partial rosters', async () => {
    m.sql.mockReset().mockResolvedValueOnce([{ id: 'quote' }])
      .mockResolvedValueOnce([job]).mockResolvedValueOnce([{ ...crew, version: 3 }])
    await expect(issue()).rejects.toThrow('Crew version')
    expect(m.create).not.toHaveBeenCalled()
    m.sql.mockReset().mockResolvedValueOnce([{ id: 'quote' }])
      .mockResolvedValueOnce([job]).mockResolvedValueOnce([crew])
    m.slots.mockResolvedValue([slots[0]])
    await expect(issue()).rejects.toThrow('Entire crew')
    expect(m.create).not.toHaveBeenCalled()
  })

  it('refuses a second challenge for the same worker and epoch', async () => {
    m.existing.mockResolvedValue({ id: 'already-issued' })
    await expect(issue()).rejects.toThrow('already issued')
    expect(m.create).not.toHaveBeenCalled()
  })

  it('never issues if any worker loses capability or customer photo freshness', async () => {
    m.candidate.mockResolvedValueOnce({ eligible: false })
    await expect(issue()).rejects.toThrow('lost eligibility')
    expect(m.create).not.toHaveBeenCalled()
  })

  it('rejects unconfigured signing key and malformed customer scope', async () => {
    await expect(issueStagedCrewArrivalPinInsideTransaction(tx as any, {
      ...input(), signingKey: Buffer.from('short'),
    })).rejects.toMatchObject({ status: 400 })
    expect(m.key).not.toHaveBeenCalled()
  })
})
