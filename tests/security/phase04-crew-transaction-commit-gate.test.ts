import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { checkCrewRosterAtCommit } from '@/lib/domain/company-crew-commit-gate'

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
}))

const tx = {
  $queryRaw: mock.sql,
  companyJobAssignment: { findFirst: mock.assignment },
  companyCrewDispatch: { findUnique: mock.crew },
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

  it('does not expose a persistence or dispatch endpoint', async () => {
    const result = await checkCrewRosterAtCommit(input)
    expect(result.dispatchEnabled).toBe(false)
    expect(tx).not.toHaveProperty('create')
    expect(tx).not.toHaveProperty('update')
  })
})
