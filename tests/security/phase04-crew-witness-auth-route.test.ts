import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

const m = vi.hoisted(() => ({
  actor: 'customer' as string | null,
  suspended: false,
  crew: vi.fn(), customer: vi.fn(), worker: vi.fn(),
  record: vi.fn(), transaction: vi.fn(), log: vi.fn(),
}))
vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => m.actor ? { id: m.actor } : null,
  assertNotSuspended: () => m.suspended
    ? NextResponse.json({ error: 'Suspended' }, { status: 403 }) : null,
}))
vi.mock('@/lib/domain/company-crew-presence-record', () => ({
  recordCrewPresenceWitnessInsideTransaction: m.record,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: m.transaction },
}))
vi.mock('@/lib/shared/observability/secure-console', () => ({
  secureConsole: { error: m.log },
}))
const tx = {
  companyCrewDispatch: { findFirst: m.crew },
  marketplaceJob: { findFirst: m.customer },
  companyJobAssignment: { findFirst: m.worker },
}
const valid = { crewDispatchId: 'crew', assignmentId: 'slot-1', expectedVersion: 3 }
async function post(
  payload: unknown = valid, jobId = 'job-1', additional: Record<string, string> = {},
) {
  const { POST } = await import('@/app/api/mobile/v2/jobs/[id]/crew-witness/route')
  return POST(new NextRequest('http://localhost/api/mobile/v2/jobs/'+jobId+'/crew-witness', {
    method: 'POST', headers: { 'content-type': 'application/json', ...additional },
    body: JSON.stringify(payload),
  }), { params: Promise.resolve({ id: jobId }) })
}
describe('Phase04 opt-in development witness actor-bound route (never arrival)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.actor = 'customer'
    m.suspended = false
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('MAINTAINEX_PHASE04_CREW_WITNESS_TEST_ENABLED', 'true')
    vi.stubEnv('DATABASE_URL', 'postgresql://phase04_fixture:isolated_secret@127.0.0.1:5432/maintainex_test_phase07_ci')
    m.crew.mockResolvedValue({ id: 'crew' })
    m.customer.mockResolvedValue({ id: 'job-1' })
    m.worker.mockResolvedValue(null)
    m.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(tx))
    m.record.mockResolvedValue({
      crewDispatchId: 'crew', crewVersion: 3, assignmentId: 'slot-1',
      participantRecorded: 'CUSTOMER',
      physicalPresenceVerified: true, arrivalEnabled: true, workStartEnabled: true,
      secretPin: '123456',
    })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('always refuses production, even with opt-in set, before authentication/database use', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const response = await post()
    expect(response.status).toBe(409)
    expect(m.transaction).not.toHaveBeenCalled()
    expect(m.record).not.toHaveBeenCalled()
  })
  it('refuses unset or disabled test feature flag', async () => {
    vi.stubEnv('MAINTAINEX_PHASE04_CREW_WITNESS_TEST_ENABLED', 'false')
    expect((await post()).status).toBe(409)
    expect(m.transaction).not.toHaveBeenCalled()
  })
  it('denies production-like, remote, unnamed, socket or overridden databases before authentication', async () => {
    for (const url of [
      'postgresql://user:pass@db.internal:5432/maintainex_test_phase07_ci',
      'postgresql://user:pass@127.0.0.1:5432/maintainex',
      'postgresql://user:pass@localhost:5432/maintainex_production',
      'postgresql://user:pass@localhost:5432/maintainex_test_phase07_ci?schema=private',
      'postgresql://user:pass@localhost:5432/maintainex_test_phase07_ci?host=remote-server',
      'postgresql://user:pass@localhost:5432/maintainex_test_phase07_ci?schema=public&schema=public',
      'postgresql://user:pass@localhost:5432/maintainex_test_phase07_ci?service=some-service',
      'file:./dev.db', 'not-a-url', '',
    ]) {
      vi.stubEnv('DATABASE_URL', url)
      const response = await post()
      expect(response.status).toBe(409)
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
      expect(m.transaction).not.toHaveBeenCalled()
      expect(m.record).not.toHaveBeenCalled()
    }
  })
  it('rejects cross-site simple content types and requires an explicit JSON body', async () => {
    const { POST } = await import('@/app/api/mobile/v2/jobs/[id]/crew-witness/route')
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data', '']) {
      const response = await POST(new NextRequest(
        'http://localhost/api/mobile/v2/jobs/job-1/crew-witness', {
          method: 'POST', body: JSON.stringify(valid),
          headers: type ? { 'content-type': type } : {},
        },
      ), { params: Promise.resolve({ id: 'job-1' }) })
      expect(response.status).toBe(415)
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    }
    expect(m.transaction).not.toHaveBeenCalled()
    expect(m.record).not.toHaveBeenCalled()
  })
  it('binds the authenticated customer and exact URL booking in SERIALIZABLE transaction', async () => {
    const response = await post()
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).toEqual({
      crewDispatchId: 'crew', crewVersion: 3, assignmentId: 'slot-1',
      participantRecorded: 'CUSTOMER',
      physicalPresenceVerified: false, arrivalEnabled: false, workStartEnabled: false,
    })
    expect(m.crew).toHaveBeenCalledWith({
      where: { id: 'crew', jobId: 'job-1' }, select: { id: true },
    })
    expect(m.customer).toHaveBeenCalledWith({
      where: { id: 'job-1', customerId: 'customer' }, select: { id: true },
    })
    expect(m.record).toHaveBeenCalledWith(tx, {
      crewDispatchId: 'crew', assignmentId: 'slot-1', expectedVersion: 3,
      authenticatedUserId: 'customer', participant: 'CUSTOMER',
    })
    expect(m.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })
  it('selects WORKER from own accepted assignment, never from a body-provided role', async () => {
    m.actor = 'worker-1'
    m.customer.mockResolvedValue(null)
    m.worker.mockResolvedValue({ id: 'slot-1' })
    m.record.mockResolvedValue({
      crewDispatchId: 'crew', crewVersion: 3, assignmentId: 'slot-1',
      participantRecorded: 'WORKER',
    })
    const response = await post()
    expect(response.status).toBe(200)
    expect(m.worker).toHaveBeenCalledWith({
      where: {
        id: 'slot-1', jobId: 'job-1', crewDispatchId: 'crew',
        workerUserId: 'worker-1', status: 'CREW_ACCEPTED',
      },
      select: { id: true },
    })
    expect(m.record).toHaveBeenCalledWith(tx, expect.objectContaining({
      authenticatedUserId: 'worker-1', participant: 'WORKER',
    }))
  })
  it('denies unauthenticated, suspended and unrelated coworkers without revealing crew', async () => {
    m.actor = null
    expect((await post()).status).toBe(401)
    m.actor = 'worker-2'
    m.suspended = true
    const suspended = await post()
    expect(suspended.status).toBe(403)
    expect(suspended.headers.get('Cache-Control')).toBe('private, no-store')
    m.suspended = false
    m.customer.mockResolvedValue(null)
    m.worker.mockResolvedValue(null)
    expect((await post()).status).toBe(404)
    expect(m.record).not.toHaveBeenCalled()
  })
  it('does not allow a customer of a different URL job or an overlapping self-witness', async () => {
    m.crew.mockResolvedValue(null)
    expect((await post()).status).toBe(404)
    expect(m.customer).not.toHaveBeenCalled()
    m.crew.mockResolvedValue({ id: 'crew' })
    m.worker.mockResolvedValue({ id: 'slot-1' })
    expect((await post()).status).toBe(409)
    expect(m.record).not.toHaveBeenCalled()
  })
  it('refuses every client-supplied authority, PIN, timestamp or extra field', async () => {
    for (const field of [
      'participant', 'authenticatedUserId', 'customerUserId',
      'workerUserId', 'actorRole', 'pin', 'pinDigest',
      'workerAttestedAt', 'customerAttestedAt', 'physicalPresenceVerified',
      'arrivalEnabled', 'workStartEnabled', 'jobId',
    ]) {
      expect((await post({ ...valid, [field]: 'spoof' })).status).toBe(400)
    }
    for (const invalid of [
      null, [], { ...valid, crewDispatchId: '' },
      { ...valid, assignmentId: '' },
      { ...valid, expectedVersion: 0 },
      { ...valid, expectedVersion: 3.1 },
      { ...valid, expectedVersion: '3' },
      { ...valid, expectedVersion: Number.MAX_SAFE_INTEGER + 1 },
    ]) expect((await post(invalid)).status).toBe(400)
    expect(m.transaction).not.toHaveBeenCalled()
  })
  it('rejects oversized request payload before database access', async () => {
    const oversized = await post(valid,'job-1',{ 'content-length': '99999' })
    expect(oversized.status).toBe(400)
    expect(m.transaction).not.toHaveBeenCalled()
  })
  it('returns 409 for stale crew epoch without mutating the witness', async () => {
    const { CrewCommitGateError } = await import('@/lib/domain/company-crew-commit-gate')
    m.record.mockRejectedValue(new CrewCommitGateError('Crew booking or epoch changed'))
    const response = await post()
    expect(response.status).toBe(409)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).not.toHaveProperty('pin')
  })
})
