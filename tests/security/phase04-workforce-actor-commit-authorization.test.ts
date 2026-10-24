import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const db = vi.hoisted(() => ({
  actorRole: 'COMPANY_OWNER', actorRestricted: false, actorStatus: 'ACTIVE',
  target: vi.fn(), lockedTarget: vi.fn(), targetAccount: vi.fn(),
  lock: vi.fn(), update: vi.fn(), assignments: vi.fn(), count: vi.fn(), audit: vi.fn(),
}))
vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => ({ id: 'owner', role: 'COMPANY' }),
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/phase6/company-context', () => ({
  resolveCompanyContext: async () => ({
    context: { companyId: 'company', role: 'COMPANY_OWNER', membershipId: 'owner-member' },
    error: null,
  }),
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: db.audit }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    teamMember: { findFirst: db.target },
    user: { findUnique: db.targetAccount },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      $queryRaw: db.lock,
      teamMember: { findUnique: db.lockedTarget, update: db.update, count: db.count },
      companyJobAssignment: { count: db.count, findMany: db.assignments, updateMany: vi.fn() },
      marketplaceJob: { updateMany: vi.fn() },
    }),
  },
}))
async function run(action: string, role?: string) {
  const { PATCH } = await import('@/app/api/mobile/company/workforce/route')
  return PATCH(new NextRequest('http://localhost/api/mobile/company/workforce', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId: 'company', memberUserId: 'worker', action, role }),
  }))
}
describe('Phase 04 — workforce mutations reject a manager downgraded at commit', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.actorRole = 'COMPANY_OWNER'
    db.actorRestricted = false
    db.actorStatus = 'ACTIVE'
    db.target.mockResolvedValue({ id: 'target', companyId: 'company', userId: 'worker',
      name: 'Worker', role: 'WORKER', status: 'ACTIVE' })
    db.lockedTarget.mockResolvedValue({ role: 'WORKER', status: 'ACTIVE' })
    db.targetAccount.mockResolvedValue({ isActive: true, isSuspended: false, isBanned: false })
    db.count.mockResolvedValue(0)
    db.assignments.mockResolvedValue([])
    db.lock.mockImplementation(async (strings: TemplateStringsArray, ...args: unknown[]) => {
      const sql = strings.join(' ')
      if (sql.includes('FROM "User"') && args[0] === 'owner') {
        return [{ isActive: true, isSuspended: db.actorRestricted, isBanned: false }]
      }
      if (sql.includes('AND "userId"')) {
        return [{ role: db.actorRole, status: db.actorStatus }]
      }
      if (sql.includes('FROM "User"')) {
        return [{ isActive: true, isSuspended: false, isBanned: false }]
      }
      return [{ id: 'target' }]
    })
  })
  it.each([
    ['change_role', 'FINANCE'],
    ['deactivate', undefined],
    ['reactivate', undefined],
  ])('refuses %s when the acting owner lost their role after preflight', async (action, role) => {
    if (action === 'reactivate') {
      db.target.mockResolvedValue({ id: 'target', role: 'WORKER', status: 'SUSPENDED',
        companyId: 'company', userId: 'worker', name: 'Worker' })
      db.lockedTarget.mockResolvedValue({ role: 'WORKER', status: 'SUSPENDED' })
    }
    db.actorRole = 'WORKER'
    const response = await run(action!, role)
    expect(response.status).toBe(403)
    expect((await response.json()).error).toContain('no longer authorized')
    expect(db.update).not.toHaveBeenCalled()
    expect(db.audit).not.toHaveBeenCalled()
  })
  it.each(['deactivate', 'change_role', 'reactivate'])(
    'refuses %s if the acting owner account was suspended after preflight', async action => {
      if (action === 'reactivate') {
        db.target.mockResolvedValue({ id: 'target', role: 'WORKER', status: 'SUSPENDED',
          companyId: 'company', userId: 'worker', name: 'Worker' })
      }
      db.actorRestricted = true
      expect((await run(action, action === 'change_role' ? 'FINANCE' : undefined)).status).toBe(403)
      expect(db.update).not.toHaveBeenCalled()
    },
  )
  it('checks locked account and role before target changes', async () => {
    const response = await run('change_role', 'FINANCE')
    expect(response.status).toBe(200)
    expect(db.lock).toHaveBeenCalledTimes(4)
    expect(db.lock.mock.invocationCallOrder[2])
      .toBeLessThan(db.update.mock.invocationCallOrder[0])
  })
})
