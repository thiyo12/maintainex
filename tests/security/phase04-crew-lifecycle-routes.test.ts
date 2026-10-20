import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const state = vi.hoisted(() => ({
  actor: 'worker-a' as string | null,
  suspended: false,
  allow: true,
  company: 'company',
  responseAccept: vi.fn(),
  responseReject: vi.fn(),
  stage: vi.fn(),
  cancel: vi.fn(),
  transaction: vi.fn(),
  invitations: vi.fn(), crews: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: state.transaction,
    companyJobAssignment: { findMany: state.invitations },
    companyCrewDispatch: { findMany: state.crews },
  },
}))
vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => state.actor ? { id: state.actor } : null,
  assertNotSuspended: () => state.suspended
    ? NextResponse.json({ error: 'Account suspended' }, { status: 403 }) : null,
}))
vi.mock('@/lib/phase6/company-context', () => ({
  resolveCompanyContext: async () => state.allow
    ? { context: { companyId: state.company, role: 'DISPATCHER' } }
    : { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) },
}))
vi.mock('@/lib/domain/company-crew-commit-gate', () => ({
  CrewCommitGateError: class CrewCommitGateError extends Error {
    constructor(message: string, public readonly status = 409) { super(message) }
  },
  stageCrewReservationInsideTransaction: state.stage,
}))
vi.mock('@/lib/domain/company-crew-lifecycle', () => ({
  acceptStagedCrewMemberInsideTransaction: state.responseAccept,
  rejectStagedCrewMemberInsideTransaction: state.responseReject,
  cancelStagedCrewInsideTransaction: state.cancel,
}))
vi.mock('@/lib/shared/observability/secure-console', () => ({
  secureConsole: { error: vi.fn() },
}))

async function call(path: 'worker/crew' | 'company/crew/roster', method: 'POST' | 'PATCH' | 'GET', body?: unknown) {
  const request = new NextRequest(`http://localhost/api/mobile/${path}`, {
    method,
    ...(method !== 'GET' ? {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    } : {}),
  })
  if (path === 'worker/crew') {
    const route = await import('@/app/api/mobile/worker/crew/route')
    if (method === 'GET') return route.GET(request)
    if (method === 'POST') return route.POST(request)
    throw new Error('Worker crew route does not support PATCH')
  }
  const route = await import('@/app/api/mobile/company/crew/roster/route')
  if (method === 'GET') return route.GET(request)
  if (method === 'PATCH') return route.PATCH(request)
  return route.POST(request)
}

describe('Phase04 crew decision routes: authenticated identity and fail-closed scope', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    state.actor = 'worker-a'
    state.suspended = false
    state.allow = true
    state.company = 'company'
    state.transaction.mockImplementation(async fn => fn({ marker: 'tx' }))
    state.responseAccept.mockResolvedValue({ status: 'FORMING', dispatchEnabled: false })
    state.responseReject.mockResolvedValue({ status: 'BLOCKED', dispatchEnabled: false })
    state.stage.mockResolvedValue({ status: 'FORMING', dispatchEnabled: false })
    state.cancel.mockResolvedValue({ status: 'CANCELLED', dispatchEnabled: false })
    state.invitations.mockResolvedValue([])
    state.crews.mockResolvedValue([])
  })

  it('does not let an unauthenticated visitor read or answer crew invitations', async () => {
    state.actor = null
    expect((await call('worker/crew', 'GET')).status).toBe(401)
    expect((await call('worker/crew', 'POST', {
      crewDispatchId: 'crew', action: 'accept', expectedVersion: 1,
    })).status).toBe(401)
    expect(state.transaction).not.toHaveBeenCalled()
    expect(state.invitations).not.toHaveBeenCalled()
  })

  it('reads only the current account invitations without coworkers or customer details', async () => {
    const response = await call('worker/crew', 'GET')
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(state.invitations).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        workerUserId: 'worker-a',
        status: { in: ['CREW_RESERVED', 'CREW_ACCEPTED'] },
        crewDispatch: { status: 'FORMING' },
        company: { teamMembers: { some: {
          userId: 'worker-a', status: 'ACTIVE', role: 'WORKER',
        } } },
      }),
      take: 50,
    }))
  })

  it('binds an acceptance to the authenticated worker in a SERIALIZABLE transaction', async () => {
    const response = await call('worker/crew', 'POST', {
      crewDispatchId: 'crew', action: 'accept', expectedVersion: 1,
    })
    expect(response.status).toBe(200)
    expect((await response.json()).dispatchEnabled).toBe(false)
    expect(state.transaction).toHaveBeenCalledWith(
      expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }),
    )
    expect(state.responseAccept).toHaveBeenCalledWith({ marker: 'tx' }, {
      crewDispatchId: 'crew', workerUserId: 'worker-a', expectedVersion: 1,
    })
    expect(state.responseReject).not.toHaveBeenCalled()
  })

  it('refusal never trusts a caller-supplied worker ID or role', async () => {
    const request = { crewDispatchId: 'crew', action: 'reject', expectedVersion: 1 }
    expect((await call('worker/crew', 'POST', { ...request, workerUserId: 'victim' })).status).toBe(400)
    expect((await call('worker/crew', 'POST', { ...request, actorUserId: 'victim' })).status).toBe(400)
    const response = await call('worker/crew', 'POST', { ...request, reason: 'Cannot attend' })
    expect(response.status).toBe(200)
    expect(state.responseReject).toHaveBeenCalledWith({ marker: 'tx' }, {
      crewDispatchId: 'crew', workerUserId: 'worker-a',
      expectedVersion: 1, reason: 'Cannot attend',
    })
  })

  it('rejects invalid worker decisions and suspended accounts before writes', async () => {
    for (const bad of [
      null, { crewDispatchId: 'crew', expectedVersion: 0, action: 'accept' },
      { crewDispatchId: 'crew', expectedVersion: 1.5, action: 'accept' },
      { crewDispatchId: 'crew', expectedVersion: 1, action: 'dispatch' },
      { crewDispatchId: 'crew', expectedVersion: 1, action: 'reject', reason: 'x'.repeat(251) },
    ]) {
      expect((await call('worker/crew', 'POST', bad)).status).toBe(400)
    }
    state.suspended = true
    expect((await call('worker/crew', 'POST', { crewDispatchId: 'crew',
      expectedVersion: 1, action: 'accept' })).status).toBe(403)
    expect(state.transaction).not.toHaveBeenCalled()
  })

  it('lists only forming crews belonging to an active authorized company', async () => {
    state.actor = 'manager'
    const { GET } = await import('@/app/api/mobile/company/crew/roster/route')
    const response = await GET(new NextRequest('http://localhost/api/mobile/company/crew/roster?companyId=company'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(state.crews).toHaveBeenCalledWith(expect.objectContaining({
      where: { companyId: 'company', status: 'FORMING' },
      take: 50,
    }))
    expect((await response.json()).crews).toEqual([])
    state.allow = false
    expect((await GET(new NextRequest('http://localhost/api/mobile/company/crew/roster?companyId=company'))).status).toBe(403)
  })

  it('does not let a worker read another company\'s manager roster', async () => {
    state.actor = null
    const { GET } = await import('@/app/api/mobile/company/crew/roster/route')
    expect((await GET(new NextRequest('http://localhost/api/mobile/company/crew/roster?companyId=company'))).status).toBe(401)
    expect(state.crews).not.toHaveBeenCalled()
  })

  it('allows current dispatcher cancellation while staging is disabled', async () => {
    state.actor = 'dispatcher'
    const res = await call('company/crew/roster', 'PATCH', {
      companyId: 'company', crewDispatchId: 'crew', expectedVersion: 1,
      reason: 'Roster withdrawn',
    })
    expect(res.status).toBe(200)
    expect(state.cancel).toHaveBeenCalledWith({ marker: 'tx' }, {
      companyId: 'company', crewDispatchId: 'crew',
      actorUserId: 'dispatcher', actorRole: 'DISPATCHER',
      expectedVersion: 1, reason: 'Roster withdrawn',
    })
    expect((await res.json()).dispatchEnabled).toBe(false)
  })

  it('prevents a caller-supplied manager role and enforces current membership', async () => {
    state.allow = false
    expect((await call('company/crew/roster', 'PATCH', {
      companyId: 'company', crewDispatchId: 'crew', expectedVersion: 1,
    })).status).toBe(403)
    state.allow = true
    expect((await call('company/crew/roster', 'PATCH', {
      companyId: 'company', crewDispatchId: 'crew', expectedVersion: 1,
      actorRole: 'COMPANY_OWNER',
    })).status).toBe(400)
    expect(state.cancel).not.toHaveBeenCalled()
  })

  it('keeps roster staging disabled by default and permanently disabled on production', async () => {
    const oldFlag = process.env.MAINTAINEX_PHASE04_CREW_STAGING_ENABLED
    try {
      delete process.env.MAINTAINEX_PHASE04_CREW_STAGING_ENABLED
      const response = await call('company/crew/roster', 'POST', {
        companyId: 'company', jobId: 'job',
        workerUserIds: ['a', 'b'], leadWorkerUserId: 'a',
      })
      expect(response.status).toBe(409)
      expect(state.stage).not.toHaveBeenCalled()
    } finally {
      if (oldFlag === undefined) delete process.env.MAINTAINEX_PHASE04_CREW_STAGING_ENABLED
      else process.env.MAINTAINEX_PHASE04_CREW_STAGING_ENABLED = oldFlag
    }
  })
})
