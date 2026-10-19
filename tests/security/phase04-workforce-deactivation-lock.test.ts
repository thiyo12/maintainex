import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { isValidCompanyRole } from '@/lib/phase6/rbac'

const db = vi.hoisted(() => ({
  member: vi.fn(),
  lock: vi.fn(),
  memberLocked: vi.fn(),
  memberUpdate: vi.fn(),
  assignments: vi.fn(),
  revoke: vi.fn(),
  retarget: vi.fn(),
  ownerCount: vi.fn(),
  audit: vi.fn(),
}))
vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => ({ id: 'owner', role: 'COMPANY', countryCode: 'LK' }),
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/phase6/company-context', () => ({
  resolveCompanyContext: async () => ({
    context: { companyId: 'company', role: 'COMPANY_OWNER' },
    error: null,
  }),
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: db.audit }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    teamMember: { findFirst: db.member },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      $queryRaw: db.lock,
      teamMember: {
        findUnique: db.memberLocked, update: db.memberUpdate, count: db.ownerCount,
      },
      companyJobAssignment: { findMany: db.assignments, updateMany: db.revoke },
      marketplaceJob: { updateMany: db.retarget },
    }),
  },
}))

async function suspend() {
  const { PATCH } = await import('@/app/api/mobile/company/workforce/route')
  const response = await PATCH(new NextRequest('http://localhost/api/mobile/company/workforce', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      companyId: 'company', memberUserId: 'worker', action: 'deactivate',
    }),
  }))
  return { status: response.status, body: await response.json() }
}

describe('Phase 04 — company workforce suspension serializes with live dispatch', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.member.mockResolvedValue({
      id: 'membership', companyId: 'company', userId: 'worker',
      role: 'WORKER', status: 'ACTIVE', name: 'Worker',
    })
    db.memberLocked.mockResolvedValue({ role: 'WORKER', status: 'ACTIVE' })
    db.lock.mockResolvedValue([{ id: 'membership' }])
    db.assignments.mockResolvedValue([])
  })

  it('locks the membership row before querying active assignments', async () => {
    const { status } = await suspend()
    expect(status).toBe(200)
    expect(db.lock).toHaveBeenCalledTimes(2)
    expect(db.memberLocked).toHaveBeenCalledWith({
      where: { id: 'membership' }, select: { role: true, status: true },
    })
    expect(db.memberLocked.mock.invocationCallOrder[0])
      .toBeLessThan(db.assignments.mock.invocationCallOrder[0])
    expect(db.memberUpdate).toHaveBeenCalledWith({
      where: { id: 'membership' }, data: { status: 'SUSPENDED' },
    })
  })

  it('rejects a stale or removed membership without touching its assignments', async () => {
    db.memberLocked.mockResolvedValue({ role: 'WORKER', status: 'REMOVED' })
    const { status, body } = await suspend()
    expect(status).toBe(409)
    expect(body.error).toContain('concurrently')
    expect(db.assignments).not.toHaveBeenCalled()
    expect(db.memberUpdate).not.toHaveBeenCalled()
  })

  it('rejects a concurrent role change before suspending the wrong member', async () => {
    db.memberLocked.mockResolvedValue({ role: 'MANAGER', status: 'ACTIVE' })
    expect((await suspend()).status).toBe(409)
    expect(db.memberUpdate).not.toHaveBeenCalled()
  })

  it('keeps in-progress work protected against member suspension', async () => {
    db.assignments.mockResolvedValue([{ id: 'a', jobId: 'job', status: 'IN_PROGRESS' }])
    const { status, body } = await suspend()
    expect(status).toBe(409)
    expect(body.error).toMatch(/in-progress job/)
    expect(db.memberUpdate).not.toHaveBeenCalled()
  })

  it('atomically revokes only pre-start assignments before completing suspension', async () => {
    db.assignments.mockResolvedValue([
      { id: 'a', jobId: 'job', status: 'ASSIGNED' },
      { id: 'b', jobId: 'job-2', status: 'ACCEPTED' },
    ])
    const { status, body } = await suspend()
    expect(status).toBe(200)
    expect(body.revokedAssignments).toBe(2)
    expect(db.revoke).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] }, status: { in: ['ASSIGNED', 'ACCEPTED'] } },
      data: {
        status: 'REVOKED', revokedAt: expect.any(Date),
        revokedReason: 'Worker deactivated',
      },
    })
    expect(db.retarget).toHaveBeenCalledWith({
      where: {
        id: { in: ['job', 'job-2'] },
        targetTaskerId: 'worker',
        status: 'QUOTE_ACCEPTED',
      },
      data: { targetTaskerId: null },
    })
  })

  it('does not treat inherited object property names as valid company roles', () => {
    expect(isValidCompanyRole('__proto__')).toBe(false)
    expect(isValidCompanyRole('constructor')).toBe(false)
    expect(isValidCompanyRole('toString')).toBe(false)
    expect(isValidCompanyRole('WORKER')).toBe(true)
  })
})
