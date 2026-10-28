import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const m = vi.hoisted(() => ({
  guard: vi.fn(), allowed: true, countries: ['LK'] as string[] | null,
  event: vi.fn(), transaction: vi.fn(), inspect: vi.fn(), log: vi.fn(),
}))
vi.mock('@/lib/crm/security', () => ({
  guardCrmRequest: m.guard,
  assertCrmCountryAllowed: () => m.allowed,
  getCrmCountryCodes: () => m.countries,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    marketplaceRiskEvent: { findUnique: m.event },
    $transaction: m.transaction,
  },
}))
vi.mock('@/lib/domain/company-crew-safety-review-inventory', () => ({
  inspectBlockedCrewSafetyEvidenceForCrmInsideTransaction: m.inspect,
}))
vi.mock('@/lib/shared/observability/secure-console', () => ({
  secureConsole: { error: m.log },
}))

const riskMetadata = {
  crewDispatchId: 'crew', companyId: 'company',
  previousVersion: 1, blockedVersion: 2,
  consumedPinsPreserved: 1, capacityHeld: 2,
}
const triage = async (id = 'risk', suffix = '') => {
  const { GET } = await import('@/app/api/admin/risk-events/[id]/crew-safety/route')
  return GET(new NextRequest(
    'http://localhost/api/admin/risk-events/' + id + '/crew-safety' + suffix,
  ), { params: Promise.resolve({ id }) })
}
describe('Phase04 CRM risk-event safety inventory — country-scoped and never activating', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.allowed = true
    m.countries = ['LK']
    m.guard.mockResolvedValue({ ok: true, context: { adminId: 'admin', selectedMarket: 'LK' } })
    m.event.mockResolvedValue({
      id: 'risk', eventType: 'CREW_CONSUMED_PIN_SAFETY_HOLD',
      severity: 'HIGH', reviewedAt: null,
      metadata: JSON.stringify(riskMetadata),
      job: { countryCode: 'LK' },
    })
    m.transaction.mockImplementation(async callback => callback({ marker: 'tx' }))
    // Hostile mocked helper with extra confidential data: API response MUST
    // whitelist fields and deny every operational authority.
    m.inspect.mockResolvedValue({
      crewDispatchId: 'crew', crewVersion: 2,
      heldWorkerCount: 2, consumedPinClaimsPreserved: 1,
      witnessRecordsPreserved: 1, unreviewedHighRiskEvents: 1,
      manualSafetyReviewRequired: false, independentPhysicalPresenceVerified: true,
      capacityReleaseEnabled: true, crewArrivalEnabled: true,
      workStartEnabled: true, paymentsEnabled: true,
      workerUserIds: ['worker-identity'], rawPIN: '123456',
      metadata: { token: 'private' },
    })
  })
  it('requires live CRM risk read authorization and staff country guard before DB read', async () => {
    const denied = NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    m.guard.mockResolvedValue({ ok: false, response: denied })
    expect((await triage()).status).toBe(403)
    expect(m.event).not.toHaveBeenCalled()
    expect(m.transaction).not.toHaveBeenCalled()
    expect(m.guard).toHaveBeenCalledWith(expect.any(NextRequest), {
      permission: 'risk_events:read', level: 'read', requireCountryScope: true,
    })
  })
  it('responds with only sanitized counters and literal false authority flags', async () => {
    const response = await triage()
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(await response.json()).toEqual({
      crewDispatchId: 'crew', crewVersion: 2, heldWorkerCount: 2,
      consumedPinClaimsPreserved: 1, witnessRecordsPreserved: 1,
      unreviewedHighRiskEvents: 1,
      manualSafetyReviewRequired: true,
      independentPhysicalPresenceVerified: false,
      capacityReleaseEnabled: false, crewArrivalEnabled: false,
      workStartEnabled: false, paymentsEnabled: false,
    })
    expect(m.inspect).toHaveBeenCalledWith({ marker: 'tx' }, {
      crewDispatchId: 'crew', companyId: 'company', expectedVersion: 2,
      riskEventId: 'risk', allowedCountries: ['LK'],
    })
    expect(m.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    })
  })
  it('refuses cross-market evidence before transaction even when risk metadata names a crew', async () => {
    m.allowed = false
    const response = await triage()
    expect(response.status).toBe(403)
    expect(m.transaction).not.toHaveBeenCalled()
    expect(m.inspect).not.toHaveBeenCalled()
  })
  it('refuses unknown risk ids, query-based scope override and forged/invalid version', async () => {
    expect((await triage('')).status).toBe(400)
    expect((await triage('risk', '?workerUserId=another')).status).toBe(400)
    m.event.mockResolvedValueOnce({
      id: 'risk', eventType: 'CREW_CONSUMED_PIN_SAFETY_HOLD',
      severity: 'HIGH', reviewedAt: null,
      metadata: JSON.stringify({ ...riskMetadata, blockedVersion: '2' }),
      job: { countryCode: 'LK' },
    })
    expect((await triage()).status).toBe(409)
    expect(m.inspect).not.toHaveBeenCalled()
  })
  it('rejects non-HIGH unrelated, missing-job or reviewed events', async () => {
    for (const changes of [
      { severity: 'LOW' },
      { eventType: 'GENERIC_SECURITY_EVENT' },
      { job: null },
    ]) {
      m.event.mockResolvedValueOnce({
        id: 'risk', eventType: 'CREW_CONSUMED_PIN_SAFETY_HOLD',
        severity: 'HIGH', reviewedAt: null,
        metadata: JSON.stringify(riskMetadata),
        job: { countryCode: 'LK' }, ...changes,
      })
      expect((await triage()).status).toBe(404)
    }
    m.event.mockResolvedValueOnce({
      id: 'risk', eventType: 'CREW_CONSUMED_PIN_SAFETY_HOLD',
      severity: 'HIGH', reviewedAt: new Date(),
      metadata: JSON.stringify(riskMetadata),
      job: { countryCode: 'LK' },
    })
    expect((await triage()).status).toBe(409)
    expect(m.transaction).not.toHaveBeenCalled()
  })
  it('never treats malformed or unscoped metadata as a review or capacity release', async () => {
    for (const metadata of [
      'not-json', '[]', '{}', JSON.stringify({ ...riskMetadata, companyId: null }),
      JSON.stringify({ ...riskMetadata, crewDispatchId: ' ' }),
    ]) {
      m.event.mockResolvedValueOnce({
        id: 'risk', eventType: 'CREW_CONSUMED_PIN_SAFETY_HOLD',
        severity: 'HIGH', reviewedAt: null, metadata,
        job: { countryCode: 'LK' },
      })
      expect((await triage()).status).toBe(409)
    }
    expect(m.transaction).not.toHaveBeenCalled()
  })
  it('resolves the customer mismatch crew id only from stored evidence', async () => {
    m.event.mockResolvedValueOnce({
      id: 'risk', eventType: 'WORKER_IDENTITY_MISMATCH',
      severity: 'HIGH', reviewedAt: null,
      metadata: JSON.stringify({ ...riskMetadata, crewId: 'customer-crew', crewDispatchId: 'wrong' }),
      job: { countryCode: 'LK' },
    })
    expect((await triage()).status).toBe(200)
    expect(m.inspect).toHaveBeenCalledWith({ marker: 'tx' },
      expect.objectContaining({ crewDispatchId: 'customer-crew' }))
  })
  it('binds superadmin to locked country recheck, not client-supplied country lists', async () => {
    m.countries = null
    expect((await triage()).status).toBe(200)
    expect(m.inspect).toHaveBeenCalledWith({ marker: 'tx' },
      expect.objectContaining({ allowedCountries: null }))
  })
  it('fails closed on stale crew/epoch and never serializes internal error details', async () => {
    const { CrewCommitGateError } = await import('@/lib/domain/company-crew-commit-gate')
    m.inspect.mockRejectedValue(new CrewCommitGateError('private worker identifier 123'))
    const response = await triage()
    expect(response.status).toBe(409)
    expect(JSON.stringify(await response.json())).not.toContain('private')
    expect(m.log).not.toHaveBeenCalled()
  })
})
