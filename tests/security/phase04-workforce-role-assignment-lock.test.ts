import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({
  member: vi.fn(),
  memberLocked: vi.fn(),
  memberUpdate: vi.fn(),
  countAssignments: vi.fn(),
  lock: vi.fn(),
  audit: vi.fn(),
}))

vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => ({
    id: 'owner', role: 'COMPANY', name: 'Owner', countryCode: 'LK',
  }),
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/phase6/company-context', () => ({
  resolveCompanyContext: async () => ({
    context: { companyId: 'company', role: 'COMPANY_OWNER' },
    error: null,
  }),
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: mock.audit }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    teamMember: { findFirst: mock.member },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      $queryRaw: mock.lock,
      teamMember: { findUnique: mock.memberLocked, update: mock.memberUpdate },
      companyJobAssignment: { count: mock.countAssignments },
    }),
  },
}))

async function changeRole(role = 'FINANCE') {
  const { PATCH } = await import('@/app/api/mobile/company/workforce/route')
  return PATCH(new NextRequest('http://localhost/api/mobile/company/workforce', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      companyId: 'company',
      memberUserId: 'worker',
      action: 'change_role',
      role,
    }),
  }))
}

describe('Phase 04 — changing a company worker role never strands an active assignment', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.member.mockResolvedValue({
      id: 'member', companyId: 'company', userId: 'worker',
      name: 'Worker', role: 'WORKER', status: 'ACTIVE',
    })
    mock.memberLocked.mockResolvedValue({ role: 'WORKER', status: 'ACTIVE' })
    mock.memberUpdate.mockResolvedValue({ role: 'FINANCE' })
    mock.countAssignments.mockResolvedValue(0)
    mock.lock.mockImplementation(async (strings: TemplateStringsArray) => {
      const sql = strings.join(' ')
      if (sql.includes('FROM "User"')) return [{ isActive: true, isSuspended: false, isBanned: false }]
      if (sql.includes('AND "userId"')) return [{ role: 'COMPANY_OWNER', status: 'ACTIVE' }]
      return [{ id: 'member' }]
    })
  })

  it.each([1, 2])('rejects changing worker to finance while %i active assignments exist', async n => {
    mock.countAssignments.mockResolvedValue(n)
    const response = await changeRole()
    expect(response.status).toBe(409)
    expect((await response.json()).error).toMatch(/Reassign or finish/)
    expect(mock.memberUpdate).not.toHaveBeenCalled()
    expect(mock.countAssignments).toHaveBeenCalledWith({
      where: {
        companyId: 'company', workerUserId: 'worker',
        status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'CREW_RESERVED', 'CREW_ACCEPTED'] },
      },
    })
  })

  it.each(['CREW_RESERVED', 'CREW_ACCEPTED'])(
    'blocks role removal while a %s crew reservation occupies the worker', async status => {
      mock.countAssignments.mockResolvedValue(1)
      const response = await changeRole()
      expect(response.status).toBe(409)
      expect(mock.countAssignments).toHaveBeenCalledWith({
        where: {
          companyId: 'company',
          workerUserId: 'worker',
          status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'CREW_RESERVED', 'CREW_ACCEPTED'] },
        },
      })
      expect(mock.memberUpdate).not.toHaveBeenCalled()
    },
  )

  it('allows a completed and unassigned worker to change roles', async () => {
    const response = await changeRole()
    expect(response.status).toBe(200)
    expect(mock.memberUpdate).toHaveBeenCalledWith({
      where: { id: 'member' }, data: { role: 'FINANCE' },
    })
    expect(mock.audit).toHaveBeenCalledOnce()
  })

  it('checks the row after taking a membership lock', async () => {
    const response = await changeRole()
    expect(response.status).toBe(200)
    expect(mock.lock).toHaveBeenCalledTimes(4)
    expect(mock.memberLocked).toHaveBeenCalledWith({
      where: { id: 'member' },
      select: { role: true, status: true },
    })
  })

  it('rejects a stale role decision rather than overwriting a concurrent change', async () => {
    mock.memberLocked.mockResolvedValue({ role: 'MANAGER', status: 'ACTIVE' })
    const response = await changeRole()
    expect(response.status).toBe(409)
    expect(mock.memberUpdate).not.toHaveBeenCalled()
  })

  it('does not rewrite membership roles that were removed before commit', async () => {
    mock.memberLocked.mockResolvedValue({ role: 'WORKER', status: 'REMOVED' })
    const response = await changeRole()
    expect(response.status).toBe(409)
    expect(mock.memberUpdate).not.toHaveBeenCalled()
  })
})
