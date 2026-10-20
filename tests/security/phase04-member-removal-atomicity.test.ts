import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const db = vi.hoisted(() => ({
  preflight: vi.fn(),
  lock: vi.fn(),
  actor: vi.fn(),
  target: vi.fn(),
  ownerCount: vi.fn(),
  assignmentCount: vi.fn(),
  remove: vi.fn(),
  audit: vi.fn(),
}))

vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => ({ id: 'owner-user', role: 'COMPANY' }),
}))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/phase6/company-context', () => ({
  resolveCompanyContext: async () => ({
    context: { companyId: 'company', role: 'COMPANY_OWNER', membershipId: 'actor-member' },
    error: null,
  }),
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: db.audit }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    teamMember: { findFirst: db.preflight },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      $queryRaw: db.lock,
      teamMember: {
        findFirst: db.actor,
        findUnique: db.target,
        count: db.ownerCount,
        updateMany: db.remove,
      },
      companyJobAssignment: { count: db.assignmentCount },
    }),
  },
}))

async function removeMember() {
  const { DELETE } = await import('@/app/api/mobile/company/team/[id]/route')
  const response = await DELETE(
    new NextRequest('http://localhost/api/mobile/company/team/worker-member', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ companyId: 'company' }),
    }),
    { params: Promise.resolve({ id: 'worker-member' }) },
  )
  return { status: response.status, body: await response.json() }
}

describe('Phase 04 — member removal is serialized with workforce assignment and ownership', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.preflight.mockResolvedValue({
      id: 'worker-member', companyId: 'company', userId: 'worker-user',
      name: 'Worker', role: 'WORKER', status: 'ACTIVE',
    })
    db.lock.mockResolvedValueOnce([{ id: 'company' }])
      .mockResolvedValueOnce([{
        id: 'owner-user', isActive: true, isSuspended: false, isBanned: false,
      }])
      .mockResolvedValueOnce([{ id: 'actor-member' }, { id: 'worker-member' }])
    db.actor.mockResolvedValue({ role: 'COMPANY_OWNER', status: 'ACTIVE' })
    db.target.mockResolvedValue({
      id: 'worker-member', companyId: 'company', userId: 'worker-user',
      name: 'Worker', role: 'WORKER', status: 'ACTIVE',
    })
    db.ownerCount.mockResolvedValue(2)
    db.assignmentCount.mockResolvedValue(0)
    db.remove.mockResolvedValue({ count: 1 })
  })

  it('locks the company, actor account and memberships before checking assignments', async () => {
    const result = await removeMember()
    expect(result.status).toBe(200)
    expect(db.lock).toHaveBeenCalledTimes(3)
    expect(db.lock.mock.invocationCallOrder[2])
      .toBeLessThan(db.assignmentCount.mock.invocationCallOrder[0])
    expect(db.assignmentCount).toHaveBeenCalledWith({
      where: {
        companyId: 'company', workerUserId: 'worker-user',
        status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'CREW_RESERVED', 'CREW_ACCEPTED'] },
      },
    })
    expect(db.remove).toHaveBeenCalledWith({
      where: {
        id: 'worker-member', companyId: 'company',
        role: 'WORKER', status: 'ACTIVE',
      },
      data: { status: 'REMOVED' },
    })
    expect(db.audit).toHaveBeenCalledOnce()
  })

  it('rejects removal when a worker still has a live assignment', async () => {
    db.assignmentCount.mockResolvedValue(1)
    const result = await removeMember()
    expect(result.status).toBe(409)
    expect(result.body.error).toMatch(/active job/i)
    expect(db.remove).not.toHaveBeenCalled()
    expect(db.audit).not.toHaveBeenCalled()
  })

  it.each(['CREW_RESERVED', 'CREW_ACCEPTED'])(
    'denies team removal of a worker with an active %s reservation', async status => {
      db.assignmentCount.mockResolvedValue(1)
      const result = await removeMember()
      expect(result.status).toBe(409)
      expect(result.body.error).toMatch(/active job/i)
      expect(db.assignmentCount).toHaveBeenCalledWith({
        where: {
          companyId: 'company',
          workerUserId: 'worker-user',
          status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'CREW_RESERVED', 'CREW_ACCEPTED'] },
        },
      })
      expect(db.remove).not.toHaveBeenCalled()
      expect(db.audit).not.toHaveBeenCalled()
    },
  )

  it('rechecks actual owner authority under the membership lock', async () => {
    db.actor.mockResolvedValue({ role: 'WORKER', status: 'ACTIVE' })
    const result = await removeMember()
    expect(result.status).toBe(403)
    expect(db.assignmentCount).not.toHaveBeenCalled()
    expect(db.remove).not.toHaveBeenCalled()
  })

  it('rejects a restricted actor account even with a surviving owner membership', async () => {
    db.lock.mockReset().mockResolvedValueOnce([{ id: 'company' }])
      .mockResolvedValueOnce([{
        id: 'owner-user', isActive: true, isSuspended: true, isBanned: false,
      }])
    expect((await removeMember()).status).toBe(403)
    expect(db.remove).not.toHaveBeenCalled()
  })

  it('refuses the last-owner removal after serializing concurrent removals', async () => {
    db.preflight.mockResolvedValue({
      id: 'worker-member', companyId: 'company', userId: 'worker-user',
      name: 'Owner', role: 'COMPANY_OWNER', status: 'ACTIVE',
    })
    db.target.mockResolvedValue({
      id: 'worker-member', companyId: 'company', userId: 'worker-user',
      name: 'Owner', role: 'COMPANY_OWNER', status: 'ACTIVE',
    })
    db.ownerCount.mockResolvedValue(1)
    const result = await removeMember()
    expect(result.status).toBe(409)
    expect(result.body.error).toMatch(/last owner/i)
    expect(db.remove).not.toHaveBeenCalled()
  })

  it('refuses a target changed or removed while the request was in flight', async () => {
    db.target.mockResolvedValue({ companyId: 'company', role: 'WORKER', status: 'REMOVED' })
    expect((await removeMember()).status).toBe(409)
    expect(db.remove).not.toHaveBeenCalled()
  })

  it('does not emit a success or audit when the guarded update loses a race', async () => {
    db.remove.mockResolvedValue({ count: 0 })
    expect((await removeMember()).status).toBe(409)
    expect(db.audit).not.toHaveBeenCalled()
  })
})
