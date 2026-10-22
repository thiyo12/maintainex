import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CrewSafetyCaseRequiresDedicatedResolutionError,
  reviewRiskEvent,
  type RiskEventResolution,
} from '@/lib/domain/admin-risk-event'

const m = vi.hoisted(() => ({
  find: vi.fn(), update: vi.fn(), audit: vi.fn(),
  signalRead: vi.fn(), signalUpdate: vi.fn(), providerUpdate: vi.fn(),
  sql: vi.fn(), roster: vi.fn(), pins: vi.fn(), witnesses: vi.fn(),
  workspace: vi.fn(), legacyArrival: vi.fn(),
}))

const tx = {
  marketplaceRiskEvent: { findUnique: m.find, updateMany: m.update },
  auditLog: { create: m.audit },
  $queryRaw: m.sql,
  companyJobAssignment: { findMany: m.roster },
  companyCrewPinChallenge: { findFirst: m.pins },
  companyCrewPresenceWitness: { findFirst: m.witnesses },
  jobWorkspace: { findUnique: m.workspace },
  jobVerificationPin: { findFirst: m.legacyArrival },
  providerIntegritySignal: {
    findUnique: m.signalRead, update: m.signalUpdate, count: vi.fn(),
  },
  providerIdentity: { updateMany: m.providerUpdate },
}
const session = {
  id: 'staff', email: 'staff@example.invalid', role: 'MANAGER',
  firstName: '', lastName: '', assignedCountries: ['LK'], authType: 'adminUser',
}
const safeMismatch = {
  companyId: 'company', crewId: 'crew', assignmentId: 'slot1',
  workerUserId: 'worker1', previousVersion: 1, blockedVersion: 2,
  consumedPinsPreserved: 0, capacityHeldForReview: 0,
}
const call = (
  resolution: RiskEventResolution,
  allowedCountries: string[] | null = ['LK'],
) => reviewRiskEvent(tx as any, {
  eventId: 'risk', resolution, reason: 'Investigated by CRM',
  session: session as any, ipAddress: '127.0.0.1', allowedCountries,
})
const event = (eventType: string, metadata: unknown, status: Date | null = null) => ({
  id: 'risk', jobId: 'job-1', eventType, severity: 'HIGH', actorUserId: 'customer',
  resolution: null, reviewedAt: status,
  metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata),
})

describe('Phase04 pending crew HIGH safety risk is never closed by generic CRM review', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.update.mockResolvedValue({ count: 1 })
    m.audit.mockResolvedValue({})
    m.sql.mockResolvedValueOnce([{
      id: 'job-1', status: 'QUOTE_ACCEPTED', workersCount: 2, countryCode: 'LK',
    }]).mockResolvedValueOnce([{
      id: 'crew', jobId: 'job-1', companyId: 'company',
      status: 'BLOCKED', version: 2, requiredWorkersCount: 2,
    }])
    m.roster.mockResolvedValue([
      { id: 'slot1', jobId: 'job-1', companyId: 'company',
        workerUserId: 'worker1', status: 'REVOKED',
        startedAt: null, crewArrivedAt: null },
      { id: 'slot2', jobId: 'job-1', companyId: 'company',
        workerUserId: 'worker2', status: 'REVOKED',
        startedAt: null, crewArrivedAt: null },
    ])
    m.pins.mockResolvedValue(null)
    m.witnesses.mockResolvedValue(null)
    m.workspace.mockResolvedValue(null)
    m.legacyArrival.mockResolvedValue(null)
  })

  it.each([
    'CONFIRMED', 'DISMISSED', 'ESCALATED', 'NO_ACTION',
  ] as RiskEventResolution[])('%s cannot mark consumed-PIN crew hold REVIEWED', async resolution => {
    m.find.mockResolvedValue(event('CREW_CONSUMED_PIN_SAFETY_HOLD', {
      companyId: 'company', crewDispatchId: 'crew',
      previousVersion: 1, blockedVersion: 2,
      consumedPinsPreserved: 1, capacityHeld: 2,
    }))
    await expect(call(resolution))
      .rejects.toBeInstanceOf(CrewSafetyCaseRequiresDedicatedResolutionError)
    expect(m.update).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
    expect(m.signalUpdate).not.toHaveBeenCalled()
  })

  it.each([
    'CONFIRMED', 'DISMISSED', 'ESCALATED', 'NO_ACTION',
  ] as RiskEventResolution[])('%s cannot close workforce safety-held crew', async resolution => {
    m.find.mockResolvedValue(event('CREW_WORKFORCE_PIN_SAFETY_HOLD', {
      companyId: 'company', crewDispatchId: 'crew',
      previousVersion: 1, blockedVersion: 2,
      consumedPinsPreserved: 1, capacityHeldForReview: 2,
    }))
    await expect(call(resolution))
      .rejects.toBeInstanceOf(CrewSafetyCaseRequiresDedicatedResolutionError)
    expect(m.update).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
  })

  it.each([
    { consumedPinsPreserved: 1, capacityHeldForReview: 2 },
    { consumedPinsPreserved: 0, capacityHeldForReview: 2 },
    { consumedPinsPreserved: 1, capacityHeldForReview: 0 },
    { consumedPinsPreserved: null, capacityHeldForReview: 0 },
    { consumedPinsPreserved: 0, capacityHeldForReview: undefined },
    { blockedVersion: 999 },
  ])('keeps ambiguous or consumed-PIN customer mismatch in the pending queue: %j', async change => {
    m.find.mockResolvedValue(event('WORKER_IDENTITY_MISMATCH', {
      ...safeMismatch, ...change,
    }))
    await expect(call('NO_ACTION'))
      .rejects.toBeInstanceOf(CrewSafetyCaseRequiresDedicatedResolutionError)
    expect(m.update).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
  })

  it.each(['not-json', '{}', '[]', 'null'])(
    'fails closed on missing or legacy customer mismatch metadata: %s', async metadata => {
      m.find.mockResolvedValue(event('WORKER_IDENTITY_MISMATCH', metadata))
      await expect(call('DISMISSED'))
        .rejects.toBeInstanceOf(CrewSafetyCaseRequiresDedicatedResolutionError)
      expect(m.update).not.toHaveBeenCalled()
    },
  )

  it('permits ordinary no-consumed-PIN customer mismatch through existing audited review', async () => {
    m.find.mockResolvedValue(event('WORKER_IDENTITY_MISMATCH', safeMismatch))
    const result = await call('CONFIRMED')
    expect(result.success).toBe(true)
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'risk', reviewedAt: null },
      data: expect.objectContaining({ reviewedBy: 'staff', resolution: 'CONFIRMED' }),
    }))
    expect(m.audit).toHaveBeenCalledOnce()
    expect(m.sql).toHaveBeenCalledTimes(2)
    // The raw queries are in canonical MarketplaceJob -> CrewDispatch order
    // and keep exclusive row locks until the CRM transaction completes.
    // Prisma's tagged $queryRaw passes a TemplateStringsArray as the
    // first argument (the mock does not receive a Prisma.Sql object).
    expect(m.sql.mock.calls[0][0].join(' ')).toContain('"MarketplaceJob"')
    expect(m.sql.mock.calls[0][0].join(' ')).toContain('FOR UPDATE')
    expect(m.sql.mock.calls[1][0].join(' ')).toContain('"CompanyCrewDispatch"')
    expect(m.sql.mock.calls[1][0].join(' ')).toContain('FOR UPDATE')
  })

  it('refuses forged zero-hold metadata when PostgreSQL still has any consumed PIN in old epochs', async () => {
    m.find.mockResolvedValue(event('WORKER_IDENTITY_MISMATCH', safeMismatch))
    m.pins.mockResolvedValue({ id: 'historically-consumed-pin' })
    await expect(call('DISMISSED')).rejects
      .toBeInstanceOf(CrewSafetyCaseRequiresDedicatedResolutionError)
    expect(m.pins).toHaveBeenCalledWith({
      where: {
        crewDispatchId: 'crew',
        OR: [{ consumedAt: { not: null } }, { revokedAt: null }],
      },
      select: { id: true },
    })
    expect(m.update).not.toHaveBeenCalled()
  })

  it('cannot close a no-held mismatch with an unrevoked historical crew arrival challenge', async () => {
    m.find.mockResolvedValue(event('WORKER_IDENTITY_MISMATCH', safeMismatch))
    m.pins.mockResolvedValue({ id: 'unrevoked-expired-pin' })
    await expect(call('NO_ACTION')).rejects
      .toBeInstanceOf(CrewSafetyCaseRequiresDedicatedResolutionError)
    expect(m.update).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
  })

  it('refuses an active unconsumed legacy arrival PIN even with zero counters', async () => {
    m.find.mockResolvedValue(event('WORKER_IDENTITY_MISMATCH', safeMismatch))
    m.legacyArrival.mockResolvedValue({ id: 'legacy-active-pin' })
    await expect(call('DISMISSED')).rejects
      .toBeInstanceOf(CrewSafetyCaseRequiresDedicatedResolutionError)
    expect(m.legacyArrival).toHaveBeenCalledWith({
      where: {
        jobId: 'job-1',
        OR: [
          { status: 'ACTIVE' },
          { arrivalVerifiedAt: { not: null } },
          { workStartVerifiedAt: { not: null } },
          { completionVerifiedAt: { not: null } },
        ],
      },
      select: { id: true },
    })
    expect(m.update).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
  })

  it('denies an event when crew capacity is actually still accepted', async () => {
    m.find.mockResolvedValue(event('WORKER_IDENTITY_MISMATCH', safeMismatch))
    m.roster.mockResolvedValue([
      { id: 'slot1', jobId: 'job-1', companyId: 'company',
        workerUserId: 'worker1', status: 'CREW_ACCEPTED',
        startedAt: null, crewArrivedAt: null },
      { id: 'slot2', jobId: 'job-1', companyId: 'company',
        workerUserId: 'worker2', status: 'REVOKED',
        startedAt: null, crewArrivedAt: null },
    ])
    await expect(call('NO_ACTION')).rejects
      .toBeInstanceOf(CrewSafetyCaseRequiresDedicatedResolutionError)
    expect(m.update).not.toHaveBeenCalled()
  })

  it('rejects an earlier or re-formed crew epoch and unrelated booking', async () => {
    m.find.mockResolvedValue(event('WORKER_IDENTITY_MISMATCH', safeMismatch))
    m.sql.mockReset().mockResolvedValueOnce([{
      id: 'job-1', status: 'QUOTE_ACCEPTED', workersCount: 2, countryCode: 'LK',
    }]).mockResolvedValueOnce([{
      id: 'crew', jobId: 'another-job', companyId: 'company',
      status: 'BLOCKED', version: 3, requiredWorkersCount: 2,
    }])
    await expect(call('CONFIRMED')).rejects
      .toBeInstanceOf(CrewSafetyCaseRequiresDedicatedResolutionError)
    expect(m.roster).not.toHaveBeenCalled()
    expect(m.update).not.toHaveBeenCalled()
  })

  it('denies a CRM reviewer when locked booking country differs from selected market', async () => {
    m.find.mockResolvedValue(event('WORKER_IDENTITY_MISMATCH', safeMismatch))
    await expect(call('NO_ACTION', ['CA'])).rejects
      .toBeInstanceOf(CrewSafetyCaseRequiresDedicatedResolutionError)
    expect(m.roster).not.toHaveBeenCalled()
    expect(m.update).not.toHaveBeenCalled()
  })

  it('denies absent or forged CRM country-scope input before reading booking evidence', async () => {
    m.find.mockResolvedValue(event('WORKER_IDENTITY_MISMATCH', safeMismatch))
    await expect(reviewRiskEvent(tx as any, {
      eventId: 'risk', resolution: 'NO_ACTION',
      reason: 'Investigated by CRM', session: session as any,
      ipAddress: '127.0.0.1',
    })).rejects.toBeInstanceOf(CrewSafetyCaseRequiresDedicatedResolutionError)
    expect(m.sql).not.toHaveBeenCalled()
    expect(m.update).not.toHaveBeenCalled()
  })

  it('does not infer global market access from empty or malformed assignments', async () => {
    m.find.mockResolvedValue(event('WORKER_IDENTITY_MISMATCH', safeMismatch))
    for (const scope of [[], ['lk'], ['LK', 'USA']]) {
      await expect(call('NO_ACTION', scope)).rejects
        .toBeInstanceOf(CrewSafetyCaseRequiresDedicatedResolutionError)
    }
    expect(m.update).not.toHaveBeenCalled()
  })

  it('permits explicit ALL-market superadmin scope while retaining no-hold evidence guards', async () => {
    m.find.mockResolvedValue(event('WORKER_IDENTITY_MISMATCH', safeMismatch))
    expect((await call('NO_ACTION', null)).success).toBe(true)
    expect(m.update).toHaveBeenCalledOnce()
    expect(m.audit).toHaveBeenCalledOnce()
  })

  it('refuses a job moved out of the live market even with an old LK risk-event preflight', async () => {
    m.find.mockResolvedValue(event('WORKER_IDENTITY_MISMATCH', safeMismatch))
    m.sql.mockReset().mockResolvedValueOnce([{
      id: 'job-1', status: 'QUOTE_ACCEPTED', workersCount: 2, countryCode: 'CA',
    }]).mockResolvedValueOnce([{
      id: 'crew', jobId: 'job-1', companyId: 'company',
      status: 'BLOCKED', version: 2, requiredWorkersCount: 2,
    }])
    await expect(call('DISMISSED', ['LK'])).rejects
      .toBeInstanceOf(CrewSafetyCaseRequiresDedicatedResolutionError)
    expect(m.update).not.toHaveBeenCalled()
    expect(m.roster).not.toHaveBeenCalled()
  })

  it('refuses a cancelled or moved booking under the locked job row before checking PINs', async () => {
    m.find.mockResolvedValue(event('WORKER_IDENTITY_MISMATCH', safeMismatch))
    m.sql.mockReset().mockResolvedValueOnce([{
      id: 'job-1', status: 'CANCELLED', workersCount: 2, countryCode: 'LK',
    }]).mockResolvedValueOnce([{
      id: 'crew', jobId: 'job-1', companyId: 'company',
      status: 'BLOCKED', version: 2, requiredWorkersCount: 2,
    }])
    await expect(call('NO_ACTION')).rejects
      .toBeInstanceOf(CrewSafetyCaseRequiresDedicatedResolutionError)
    expect(m.roster).not.toHaveBeenCalled()
    expect(m.update).not.toHaveBeenCalled()
  })

  it('refuses inconsistent locked job roster counts without closing the risk', async () => {
    m.find.mockResolvedValue(event('WORKER_IDENTITY_MISMATCH', safeMismatch))
    m.sql.mockReset().mockResolvedValueOnce([{
      id: 'job-1', status: 'QUOTE_ACCEPTED', workersCount: 3, countryCode: 'LK',
    }]).mockResolvedValueOnce([{
      id: 'crew', jobId: 'job-1', companyId: 'company',
      status: 'BLOCKED', version: 2, requiredWorkersCount: 2,
    }])
    await expect(call('DISMISSED')).rejects
      .toBeInstanceOf(CrewSafetyCaseRequiresDedicatedResolutionError)
    expect(m.update).not.toHaveBeenCalled()
  })

  it('rejects preserved witness or workspace evidence even with zero JSON counters', async () => {
    m.find.mockResolvedValue(event('WORKER_IDENTITY_MISMATCH', safeMismatch))
    m.witnesses.mockResolvedValue({ id: 'witness' })
    await expect(call('ESCALATED')).rejects
      .toBeInstanceOf(CrewSafetyCaseRequiresDedicatedResolutionError)
    expect(m.update).not.toHaveBeenCalled()
  })

  it('does not affect non-crew risk events or provider workflows', async () => {
    m.find.mockResolvedValue(event('SUSPICIOUS_BID_PATTERN', {
      message: 'unrelated risk',
    }))
    expect((await call('ESCALATED')).success).toBe(true)
    expect(m.update).toHaveBeenCalledOnce()
    expect(m.audit).toHaveBeenCalledOnce()
  })

  it('preserves pre-existing reviewed-event conflict without touching new state', async () => {
    m.find.mockResolvedValue(event('CREW_CONSUMED_PIN_SAFETY_HOLD', {},
      new Date('2026-10-20T00:00:00Z')))
    await expect(call('DISMISSED')).rejects.toThrow('already reviewed')
    expect(m.update).not.toHaveBeenCalled()
  })
})
