import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({
  member: vi.fn(), user: vi.fn(), lock: vi.fn(), lockedMember: vi.fn(),
  update: vi.fn(), audit: vi.fn(),
  workerAccount: { isActive: true, isSuspended: false, isBanned: false },
}))
vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => ({ id: 'owner', role: 'COMPANY' }),
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/phase6/company-context', () => ({
  resolveCompanyContext: async () => ({
    context: { companyId: 'company', role: 'COMPANY_OWNER' }, error: null,
  }),
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: mock.audit }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    teamMember: { findFirst: mock.member },
    user: { findUnique: mock.user },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb({
      $queryRaw: mock.lock,
      teamMember: { findUnique: mock.lockedMember, update: mock.update },
    }),
  },
}))
async function reactivate() {
  const { PATCH } = await import('@/app/api/mobile/company/workforce/route')
  const res = await PATCH(new NextRequest('http://localhost/api/mobile/company/workforce', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ companyId: 'company', memberUserId: 'worker', action: 'reactivate' }),
  }))
  return { status: res.status, body: await res.json() }
}
describe('Phase 04 — membership reactivation revalidates global restrictions at commit', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.member.mockResolvedValue({
      id: 'member', companyId: 'company', userId: 'worker',
      name: 'Worker', role: 'WORKER', status: 'SUSPENDED',
    })
    mock.user.mockResolvedValue({ isActive: true, isSuspended: false, isBanned: false })
    mock.workerAccount = { isActive: true, isSuspended: false, isBanned: false }
    mock.lock.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join(' ')
      if (sql.includes('FROM "User"')) {
        return [values[0] === 'worker'
          ? mock.workerAccount
          : { isActive: true, isSuspended: false, isBanned: false }]
      }
      if (sql.includes('AND "userId"')) return [{ role: 'COMPANY_OWNER', status: 'ACTIVE' }]
      return [{ id: 'member' }]
    })
    mock.lockedMember.mockResolvedValue({ role: 'WORKER', status: 'SUSPENDED' })
  })
  it('rechecks locked account and membership before restoring access', async () => {
    const response = await reactivate()
    expect(response.status).toBe(200)
    expect(mock.lock).toHaveBeenCalledTimes(5)
    expect(mock.lockedMember.mock.invocationCallOrder[0])
      .toBeLessThan(mock.update.mock.invocationCallOrder[0])
    expect(mock.update).toHaveBeenCalledWith({
      where: { id: 'member' }, data: { status: 'ACTIVE' },
    })
  })
  it.each([
    { isActive: false, isSuspended: false, isBanned: false },
    { isActive: true, isSuspended: true, isBanned: false },
    { isActive: true, isSuspended: false, isBanned: true },
  ])('blocks a restricted account even if preflight passed: %j', async record => {
    mock.workerAccount = record
    const response = await reactivate()
    expect(response.status).toBe(409)
    expect(response.body.error).toContain('Cannot reactivate')
    expect(mock.update).not.toHaveBeenCalled()
  })
  it('cannot resurrect a member removed during the transaction', async () => {
    mock.lockedMember.mockResolvedValue({ role: 'WORKER', status: 'REMOVED' })
    const response = await reactivate()
    expect(response.status).toBe(409)
    expect(mock.update).not.toHaveBeenCalled()
  })
  it('fails on a role changed since the caller read membership', async () => {
    mock.lockedMember.mockResolvedValue({ role: 'FINANCE', status: 'SUSPENDED' })
    expect((await reactivate()).status).toBe(409)
    expect(mock.update).not.toHaveBeenCalled()
  })
})
