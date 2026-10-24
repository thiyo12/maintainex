import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  inspectBlockedCrewSafetyEvidenceInsideTransaction,
  inspectBlockedCrewSafetyEvidenceForCrmInsideTransaction,
} from '@/lib/domain/company-crew-safety-review-inventory'

const m = vi.hoisted(() => ({
  key: vi.fn(), authorize: vi.fn(), sql: vi.fn(), roster: vi.fn(),
  pins: vi.fn(), witnesses: vi.fn(), risk: vi.fn(),
  workspace: vi.fn(), legacyArrival: vi.fn(),
}))
vi.mock('@/lib/domain/company-job-assignment', () => ({
  lockAndAssertAssignmentActorAuthorized: m.authorize,
}))
const input = {
  crewDispatchId: 'crew', companyId: 'company', expectedVersion: 2,
  actorUserId: 'manager', actorRole: 'COMPANY_OWNER',
}
const slots = [
  {
    id: 'slot1', workerUserId: 'worker1', companyId: 'company', jobId: 'job',
    status: 'CREW_ACCEPTED', crewSlot: 1, crewRole: 'LEAD',
    startedAt: null, crewArrivedAt: null,
  },
  {
    id: 'slot2', workerUserId: 'worker2', companyId: 'company', jobId: 'job',
    status: 'CREW_ACCEPTED', crewSlot: 2, crewRole: 'MEMBER',
    startedAt: null, crewArrivedAt: null,
  },
]
const pin = (id: string, changes: Record<string, unknown> = {}) => ({
  id, assignmentId: 'slot1', jobId: 'job', crewVersion: 1,
  purpose: 'ARRIVAL', consumedAt: new Date(), revokedAt: null, ...changes,
})
const safetyEvent = (changes: Record<string, unknown> = {}) => ({
  id: 'risk1', eventType: 'CREW_CONSUMED_PIN_SAFETY_HOLD',
  metadata: JSON.stringify({
    companyId: 'company', crewDispatchId: 'crew',
    previousVersion: 1, blockedVersion: 2,
    consumedPinsPreserved: 1, capacityHeld: 2,
  }), ...changes,
})
const tx = {
  companyCrewDispatch: { findUnique: m.key },
  companyJobAssignment: { findMany: m.roster },
  companyCrewPinChallenge: { findMany: m.pins },
  companyCrewPresenceWitness: { findMany: m.witnesses },
  marketplaceRiskEvent: { findMany: m.risk },
  jobWorkspace: { findUnique: m.workspace },
  jobVerificationPin: { findFirst: m.legacyArrival },
  $queryRaw: m.sql,
}
const inspect = (changes: Record<string, unknown> = {}) =>
  inspectBlockedCrewSafetyEvidenceInsideTransaction(tx as any, {
    ...input, ...changes,
  })

describe('Phase04 blocked crew review is read-only and never unlocks capacity', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.key.mockResolvedValue({ jobId: 'job', companyId: 'company' })
    m.sql.mockResolvedValueOnce([{
      id: 'job', status: 'QUOTE_ACCEPTED', workersCount: 2, countryCode: 'LK',
    }]).mockResolvedValueOnce([{
      id: 'crew', companyId: 'company', jobId: 'job',
      status: 'BLOCKED', version: 2, requiredWorkersCount: 2,
      leadWorkerUserId: 'worker1',
    }])
    m.roster.mockResolvedValue(slots)
    m.pins.mockResolvedValue([pin('pin1'), pin('pin2', {
      assignmentId: 'slot2', consumedAt: null, revokedAt: new Date(),
    })])
    m.witnesses.mockResolvedValue([{
      id: 'w1', assignmentId: 'slot1', jobId: 'job',
      crewDispatchId: 'crew', crewVersion: 1, workerUserId: 'worker1',
    }])
    m.risk.mockResolvedValue([safetyEvent()])
    m.workspace.mockResolvedValue(null)
    m.legacyArrival.mockResolvedValue(null)
  })

  it('permits preauthorized CRM triage only for the exact locked market and event id', async () => {
    const result = await inspectBlockedCrewSafetyEvidenceForCrmInsideTransaction(
      tx as any, {
        crewDispatchId: 'crew', companyId: 'company', expectedVersion: 2,
        riskEventId: 'risk1', allowedCountries: ['LK'],
      },
    )
    expect(result).toMatchObject({
      manualSafetyReviewRequired: true, capacityReleaseEnabled: false,
      crewArrivalEnabled: false, workStartEnabled: false, paymentsEnabled: false,
    })
    expect(m.authorize).not.toHaveBeenCalled()
    expect(m.sql).toHaveBeenCalledTimes(2)
  })

  it('rejects CRM access when the locked market differs from the staff assignment', async () => {
    await expect(inspectBlockedCrewSafetyEvidenceForCrmInsideTransaction(
      tx as any, {
        crewDispatchId: 'crew', companyId: 'company', expectedVersion: 2,
        riskEventId: 'risk1', allowedCountries: ['CA'],
      },
    )).rejects.toMatchObject({ status: 404 })
    expect(m.pins).not.toHaveBeenCalled()
  })

  it('cannot substitute another HIGH case from the same booking during CRM triage', async () => {
    await expect(inspectBlockedCrewSafetyEvidenceForCrmInsideTransaction(
      tx as any, {
        crewDispatchId: 'crew', companyId: 'company', expectedVersion: 2,
        riskEventId: 'different-risk', allowedCountries: ['LK'],
      },
    )).rejects.toThrow('Unreviewed HIGH')
  })

  it('requires actor authorization and returns bounded non-authorizing counts only', async () => {
    expect(await inspect()).toEqual({
      crewDispatchId: 'crew', crewVersion: 2, heldWorkerCount: 2,
      consumedPinClaimsPreserved: 1, witnessRecordsPreserved: 1,
      unreviewedHighRiskEvents: 1, manualSafetyReviewRequired: true,
      independentPhysicalPresenceVerified: false,
      capacityReleaseEnabled: false, crewArrivalEnabled: false,
      workStartEnabled: false, paymentsEnabled: false,
    })
    expect(m.authorize).toHaveBeenCalledWith(
      tx, 'company', 'manager', 'COMPANY_OWNER',
    )
    expect(m.sql).toHaveBeenCalledTimes(2)
    expect(m.risk).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        jobId: 'job', severity: 'HIGH', reviewedAt: null,
        eventType: { in: [
          'CREW_CONSUMED_PIN_SAFETY_HOLD',
          'CREW_WORKFORCE_PIN_SAFETY_HOLD',
          'WORKER_IDENTITY_MISMATCH',
        ] },
      },
    }))
    expect(tx).not.toHaveProperty('companyCrewDispatch.updateMany')
    expect(tx).not.toHaveProperty('companyJobAssignment.updateMany')
    expect(tx).not.toHaveProperty('jobWorkspace.create')
  })

  it('rejects unauthorized actors before reading the booking or PINs', async () => {
    m.authorize.mockRejectedValue(new Error('NO_MANAGER_ACCESS'))
    await expect(inspect()).rejects.toThrow('NO_MANAGER_ACCESS')
    expect(m.sql).not.toHaveBeenCalled()
    expect(m.pins).not.toHaveBeenCalled()
  })

  it('rejects malformed input or an unrelated company before inspecting worker evidence', async () => {
    await expect(inspect({ expectedVersion: 0 })).rejects.toMatchObject({ status: 400 })
    await expect(inspect({ crewDispatchId: '' })).rejects.toMatchObject({ status: 400 })
    await expect(inspect({ companyId: 'other' })).rejects.toMatchObject({ status: 404 })
    expect(m.pins).not.toHaveBeenCalled()
  })

  it('refuses stale versions and any crew that is not already BLOCKED', async () => {
    await expect(inspect({ expectedVersion: 3 })).rejects.toThrow('epoch changed')
    m.sql.mockReset().mockResolvedValueOnce([{
      id: 'job', status: 'QUOTE_ACCEPTED', workersCount: 2, countryCode: 'LK',
    }]).mockResolvedValueOnce([{
      id: 'crew', companyId: 'company', jobId: 'job',
      status: 'FORMING', version: 2, requiredWorkersCount: 2,
      leadWorkerUserId: 'worker1',
    }])
    await expect(inspect()).rejects.toThrow('scope or epoch')
  })

  it('refuses incomplete accepted capacity, arrival or an existing workspace', async () => {
    m.roster.mockResolvedValue([{ ...slots[0], status: 'REVOKED' }, slots[1]])
    await expect(inspect()).rejects.toThrow('capacity')
  })

  it('refuses a prior PIN that was consumed and later incorrectly revoked', async () => {
    m.pins.mockResolvedValue([pin('bad', { revokedAt: new Date() })])
    await expect(inspect()).rejects.toThrow('Historical arrival PIN')
  })

  it('refuses live unused challenges in any historical epoch', async () => {
    m.pins.mockResolvedValue([pin('good'), pin('unrevoked', {
      assignmentId: 'slot2', consumedAt: null,
    })])
    await expect(inspect()).rejects.toThrow('Historical arrival PIN')
  })

  it('refuses mixed worker/epoch witness evidence', async () => {
    m.witnesses.mockResolvedValue([{
      id: 'bad', assignmentId: 'slot1', jobId: 'job',
      crewDispatchId: 'crew', crewVersion: 1, workerUserId: 'outsider',
    }])
    await expect(inspect()).rejects.toThrow('Historical witness')
  })

  it('rejects missing, forged, reviewed or wrong-crew safety queue evidence', async () => {
    m.risk.mockResolvedValue([safetyEvent({
      metadata: JSON.stringify({
        companyId: 'company', crewDispatchId: 'other', blockedVersion: 2,
      }),
    })])
    await expect(inspect()).rejects.toThrow('Unreviewed HIGH')
  })

  it('accepts a customer mismatch HIGH event scoped by crewId, still with all authority false', async () => {
    m.risk.mockResolvedValue([safetyEvent({
      eventType: 'WORKER_IDENTITY_MISMATCH',
      metadata: JSON.stringify({
        companyId: 'company', crewId: 'crew',
        previousVersion: 1, blockedVersion: 2,
        consumedPinsPreserved: 1, capacityHeldForReview: 2,
        assignmentId: 'slot1', workerUserId: 'worker1',
      }),
    })])
    expect((await inspect()).capacityReleaseEnabled).toBe(false)
  })

  it('rejects a HIGH event tied to a previous crew epoch even when the crew id matches', async () => {
    m.risk.mockResolvedValue([safetyEvent({
      metadata: JSON.stringify({
        companyId: 'company', crewDispatchId: 'crew',
        previousVersion: 0, blockedVersion: 1,
        consumedPinsPreserved: 1, capacityHeld: 2,
      }),
    })])
    await expect(inspect()).rejects.toThrow('Unreviewed HIGH')
  })

  it('rejects a manager event that reports no consumed PIN or insufficient held capacity', async () => {
    m.risk.mockResolvedValue([safetyEvent({
      metadata: JSON.stringify({
        companyId: 'company', crewDispatchId: 'crew',
        previousVersion: 1, blockedVersion: 2,
        consumedPinsPreserved: 0, capacityHeld: 1,
      }),
    })])
    await expect(inspect()).rejects.toThrow('Unreviewed HIGH')
  })

  it('rejects a spoofed customer photo mismatch linked to the wrong worker', async () => {
    m.risk.mockResolvedValue([safetyEvent({
      eventType: 'WORKER_IDENTITY_MISMATCH',
      metadata: JSON.stringify({
        companyId: 'company', crewId: 'crew',
        previousVersion: 1, blockedVersion: 2,
        consumedPinsPreserved: 1, capacityHeldForReview: 2,
        assignmentId: 'slot1', workerUserId: 'worker2',
      }),
    })])
    await expect(inspect()).rejects.toThrow('Unreviewed HIGH')
  })

  it('recognizes a correct workforce suspension hold, but not another crew member', async () => {
    m.risk.mockResolvedValue([safetyEvent({
      eventType: 'CREW_WORKFORCE_PIN_SAFETY_HOLD',
      metadata: JSON.stringify({
        companyId: 'company', crewDispatchId: 'crew',
        previousVersion: 1, blockedVersion: 2,
        consumedPinsPreserved: 1, capacityHeldForReview: 2,
        affectedWorkerUserId: 'worker2', trigger: 'SUSPENDED',
      }),
    })])
    expect((await inspect()).capacityReleaseEnabled).toBe(false)
  })

  it('never mistakes an unsupported/invalid event payload for review-queue evidence', async () => {
    m.risk.mockResolvedValue([
      safetyEvent({ metadata: 'not json' }),
      safetyEvent({ metadata: JSON.stringify({ crewDispatchId: 'crew' }) }),
    ])
    await expect(inspect()).rejects.toThrow('Unreviewed HIGH')
  })
})
