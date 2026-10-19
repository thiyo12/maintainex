import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { checkCrewRosterAtCommit, assertCrewRosterReadyInsideTransaction, stageCrewReservationInsideTransaction } from '@/lib/domain/company-crew-commit-gate'

const mock = vi.hoisted(() => ({
  txWork: vi.fn(),
  sql: vi.fn(),
  actor: vi.fn(),
  schedule: vi.fn(),
  companyEligible: vi.fn(),
  workerEligible: vi.fn(),
  market: vi.fn(),
  assignment: vi.fn(),
  crew: vi.fn(),
  pin: vi.fn(),
  mismatch: vi.fn(),
  createCrew: vi.fn(),
  createMany: vi.fn(),
  audit: vi.fn(),
}))

const tx = {
  $queryRaw: mock.sql,
  companyJobAssignment: { findFirst: mock.assignment, createMany: mock.createMany },
  companyCrewDispatch: { findUnique: mock.crew, create: mock.createCrew },
  jobVerificationPin: { findFirst: mock.pin },
  jobWorkerIdentityCheck: { findFirst: mock.mismatch },
}
vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: (work: (tx: unknown) => Promise<unknown>, options: unknown) =>
    mock.txWork(work, options) },
}))
vi.mock('@/lib/domain/company-job-assignment', () => ({
  lockAndAssertAssignmentActorAuthorized: mock.actor,
  lockAndAssertWorkerScheduleAvailable: mock.schedule,
}))
vi.mock('@/lib/phase6/provider-eligibility', () => ({
  checkCompanyEligibility: mock.companyEligible,
  checkCrewCandidateEligibility: mock.workerEligible,
}))
vi.mock('@/lib/geography/market-engine', () => ({ requireJobMarket: mock.market }))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: mock.audit }))

const input = {
  companyId: 'company', jobId: 'booking', actorUserId: 'manager',
  actorRole: 'DISPATCHER', workerUserIds: ['z-worker', 'a-worker'],
}
const booking = {
  id: 'booking', status: 'QUOTE_ACCEPTED', workersCount: 2,
  countryCode: 'LK', latitude: null, longitude: null,
  preferredDate: null, preferredTimeSlot: null, targetTaskerId: null,
}

describe('Phase 04 — future crew reservation commit gate is locked and non-mutating', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.txWork.mockImplementation((work: (tx: unknown) => Promise<unknown>) => work(tx))
    mock.sql.mockResolvedValueOnce([{ id: 'quote' }])
      .mockResolvedValueOnce([booking])
      .mockResolvedValueOnce([{ id: 'company', userId: 'creator', countryCode: 'LK' }])
    mock.companyEligible.mockResolvedValue({ eligible: true, reasons: [] })
    mock.workerEligible.mockResolvedValue({ eligible: true, reasons: [] })
    mock.market.mockReturnValue({ ok: true, countryCode: 'LK' })
    mock.assignment.mockResolvedValue(null)
    mock.crew.mockResolvedValue(null)
    mock.pin.mockResolvedValue(null)
    mock.mismatch.mockResolvedValue(null)
    mock.createCrew.mockResolvedValue({ id: 'crew-1', version: 1 })
    mock.createMany.mockResolvedValue({ count: 2 })
  })

  it('locks and evaluates the entire unique roster in deterministic worker order', async () => {
    const result = await checkCrewRosterAtCommit(input)
    expect(result).toEqual({
      companyId: 'company', jobId: 'booking', requiredWorkersCount: 2,
      workerUserIds: ['a-worker', 'z-worker'],
      readyForFutureReservation: true, dispatchEnabled: false,
    })
    expect(mock.actor).toHaveBeenCalledWith(tx, 'company', 'manager', 'DISPATCHER')
    expect(mock.schedule.mock.calls.map(call => call[1])).toEqual(['a-worker', 'z-worker'])
    expect(mock.schedule).toHaveBeenCalledWith(
      tx, 'a-worker', 'booking', null, null, 'company', true,
    )
    expect(mock.workerEligible).toHaveBeenCalledWith('company', 'a-worker', 'booking', tx)
    expect(mock.companyEligible).toHaveBeenCalledWith('company', tx)
    expect(mock.txWork.mock.calls[0][1]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })

  it.each([
    ['duplicate IDs', ['same', 'same']],
    ['one worker', ['one']],
    ['too many', Array.from({ length: 13 }, (_, i) => String(i))],
    ['invalid ID', ['valid', ' bad']],
  ])('refuses %s before opening a database transaction', async (_name, workers) => {
    await expect(checkCrewRosterAtCommit({ ...input, workerUserIds: workers }))
      .rejects.toMatchObject({ status: 400 })
    expect(mock.txWork).not.toHaveBeenCalled()
  })

  it('does not look up customer booking data when accepted company quote is absent', async () => {
    mock.sql.mockReset().mockResolvedValueOnce([])
    await expect(checkCrewRosterAtCommit(input)).rejects.toMatchObject({ status: 404 })
    expect(mock.sql).toHaveBeenCalledTimes(1)
    expect(mock.workerEligible).not.toHaveBeenCalled()
  })

  it.each([
    { change: { workersCount: 3 }, error: 'Crew size or booking status changed' },
    { change: { status: 'IN_PROGRESS' }, error: 'Crew size or booking status changed' },
    { change: { targetTaskerId: 'worker-old' }, error: 'already targeted' },
  ])('fails closed on mutable job state $change', async ({ change, error }) => {
    mock.sql.mockReset().mockResolvedValueOnce([{ id: 'quote' }])
      .mockResolvedValueOnce([{ ...booking, ...change }])
      .mockResolvedValueOnce([{ id: 'company', userId: 'creator', countryCode: 'LK' }])
    await expect(checkCrewRosterAtCommit(input)).rejects.toThrow(error)
    expect(mock.schedule).not.toHaveBeenCalled()
  })

  it('blocks company market drift before worker locks', async () => {
    mock.market.mockReturnValue({ ok: true, countryCode: 'CA' })
    await expect(checkCrewRosterAtCommit(input)).rejects.toThrow('markets do not match')
    expect(mock.schedule).not.toHaveBeenCalled()
  })

  it('blocks unresolved safety/arrival evidence before reserving crew capacity', async () => {
    mock.pin.mockResolvedValue({ id: 'arrival-already-verified' })
    await expect(checkCrewRosterAtCommit(input)).rejects.toThrow('unresolved safety state')
    expect(mock.schedule).not.toHaveBeenCalled()
  })

  it('refuses loss of manager authority without checking roster', async () => {
    mock.actor.mockRejectedValue(new Error('Assigning actor is no longer authorized'))
    await expect(checkCrewRosterAtCommit(input)).rejects.toThrow('no longer authorized')
    expect(mock.sql).not.toHaveBeenCalled()
  })

  it('does not accept any roster if even one member loses schedule or exact service capability', async () => {
    mock.workerEligible.mockImplementation(async (_company: string, worker: string) => ({
      eligible: worker !== 'z-worker', reasons: worker === 'z-worker' ? ['Missing licence'] : [],
    }))
    await expect(checkCrewRosterAtCommit(input)).rejects.toThrow('no longer satisfies')
    expect(mock.workerEligible).toHaveBeenCalledTimes(2)
  })

  it('lets a future writer reuse the guard inside its OWN transaction without committing locks first', async () => {
    const result = await assertCrewRosterReadyInsideTransaction(tx as any, input)
    expect(result.dispatchEnabled).toBe(false)
    expect(mock.txWork).not.toHaveBeenCalled()
    expect(mock.schedule.mock.calls.map(call => call[1])).toEqual(['a-worker', 'z-worker'])
  })

  it('stages all slots atomically with exactly one nominated lead and no dispatch', async () => {
    const result = await stageCrewReservationInsideTransaction(tx as any, {
      ...input, leadWorkerUserId: 'z-worker',
    })
    expect(result).toEqual({
      crewDispatchId: 'crew-1', version: 1, status: 'FORMING',
      reservedWorkersCount: 2, dispatchEnabled: false,
    })
    expect(mock.createCrew).toHaveBeenCalledWith({
      data: { companyId: 'company', jobId: 'booking', requiredWorkersCount: 2,
        leadWorkerUserId: 'z-worker', status: 'FORMING', version: 1 },
      select: { id: true, version: true },
    })
    expect(mock.createMany).toHaveBeenCalledWith({
      data: [
        { companyId: 'company', jobId: 'booking', workerUserId: 'a-worker',
          assignedBy: 'manager', status: 'CREW_RESERVED', crewDispatchId: 'crew-1',
          crewSlot: 1, crewRole: 'MEMBER' },
        { companyId: 'company', jobId: 'booking', workerUserId: 'z-worker',
          assignedBy: 'manager', status: 'CREW_RESERVED', crewDispatchId: 'crew-1',
          crewSlot: 2, crewRole: 'LEAD' },
      ],
    })
    expect(mock.audit).toHaveBeenCalledOnce()
  })

  it('refuses any unselected lead before touching the database', async () => {
    await expect(stageCrewReservationInsideTransaction(tx as any, {
      ...input, leadWorkerUserId: 'stranger',
    })).rejects.toMatchObject({ status: 400 })
    expect(mock.actor).not.toHaveBeenCalled()
    expect(mock.createCrew).not.toHaveBeenCalled()
  })

  it('throws on a partial slot write so the caller transaction must roll back', async () => {
    mock.createMany.mockResolvedValue({ count: 1 })
    await expect(stageCrewReservationInsideTransaction(tx as any, {
      ...input, leadWorkerUserId: 'a-worker',
    })).rejects.toThrow('all-or-nothing')
    expect(mock.audit).not.toHaveBeenCalled()
  })

  it('does not expose a persistence or dispatch endpoint', async () => {
    const result = await checkCrewRosterAtCommit(input)
    expect(result.dispatchEnabled).toBe(false)
    expect(tx).not.toHaveProperty('create')
    expect(tx).not.toHaveProperty('update')
  })
})
