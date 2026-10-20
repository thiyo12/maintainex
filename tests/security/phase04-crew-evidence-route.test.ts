import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const state = vi.hoisted(() => ({
  actor: 'dispatcher' as string | null,
  suspended: false, allow: true,
  review: vi.fn(), transaction: vi.fn(),
}))
vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => state.actor ? { id: state.actor } : null,
  assertNotSuspended: () => state.suspended
    ? NextResponse.json({ error: 'Account suspended' }, { status: 403 }) : null,
}))
vi.mock('@/lib/phase6/company-context', () => ({
  resolveCompanyContext: async () => state.allow
    ? { context: { companyId: 'company', role: 'DISPATCHER' } }
    : { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) },
}))
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: state.transaction } }))
vi.mock('@/lib/domain/company-crew-barrier', () => ({
  assertStagedCrewIdentityEvidenceInsideTransaction: state.review,
}))
vi.mock('@/lib/shared/observability/secure-console', () => ({
  secureConsole: { error: vi.fn() },
}))
async function post(body: unknown) {
  const { POST } = await import('@/app/api/mobile/company/crew/evidence/route')
  return POST(new NextRequest('http://localhost/api/mobile/company/crew/evidence', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}
const valid = { companyId: 'company', crewDispatchId: 'crew', expectedVersion: 1 }

describe('Phase 04 — manager evidence read cannot activate a crew', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    state.actor = 'dispatcher'
    state.allow = true
    state.suspended = false
    state.transaction.mockImplementation(async callback => callback({ marker: 'tx' }))
    state.review.mockResolvedValue({
      crewDispatchId: 'crew', version: 1, requiredWorkersCount: 2,
      memberEvidenceComplete: true,
      dispatchEnabled: false, arrivalEnabled: false, workStartEnabled: false,
    })
  })

  it('denies unauthenticated and removed managers before any database transaction', async () => {
    state.actor = null
    expect((await post(valid)).status).toBe(401)
    state.actor = 'dispatcher'
    state.allow = false
    expect((await post(valid)).status).toBe(403)
    expect(state.transaction).not.toHaveBeenCalled()
  })

  it('denies caller-supplied actor authority, malformed versions and worker lists', async () => {
    for (const input of [
      null, { ...valid, actorUserId: 'victim' },
      { ...valid, actorRole: 'COMPANY_OWNER' },
      { ...valid, workerUserIds: ['outside'] },
      { ...valid, expectedVersion: 0 },
      { ...valid, expectedVersion: 1.2 },
      { ...valid, companyId: '' },
    ]) {
      expect((await post(input)).status).toBe(400)
    }
    expect(state.review).not.toHaveBeenCalled()
  })

  it('locks actual authenticated role and stays explicitly nonbinding', async () => {
    const response = await post(valid)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).toMatchObject({
      dispatchEnabled: false, arrivalEnabled: false,
      workStartEnabled: false, memberEvidenceComplete: true,
    })
    expect(state.review).toHaveBeenCalledWith({ marker: 'tx' }, {
      crewDispatchId: 'crew', expectedVersion: 1,
      actorUserId: 'dispatcher', actorRole: 'DISPATCHER',
    })
    expect(state.transaction).toHaveBeenCalledWith(expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }))
  })

  it('denies suspended actors before reviewing safety evidence', async () => {
    state.suspended = true
    expect((await post(valid)).status).toBe(403)
    expect(state.review).not.toHaveBeenCalled()
  })
})
