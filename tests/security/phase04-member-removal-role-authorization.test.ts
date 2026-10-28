import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canRemoveMemberSafe } from '@/lib/phase6/company-ownership'

const mock = vi.hoisted(() => ({ member: vi.fn(), count: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: { teamMember: { findFirst: mock.member, count: mock.count } },
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: vi.fn() }))

async function check(
  persistedRole: string | null,
  assertedRole: 'COMPANY_OWNER' | 'MANAGER' | 'WORKER' = 'COMPANY_OWNER',
  targetUserId = 'target',
) {
  mock.member.mockImplementation(async ({ where }) => {
    if (where.userId === 'actor') {
      return persistedRole ? { id: 'actor-membership', role: persistedRole } : null
    }
    return { id: 'target-membership', role: 'WORKER' }
  })
  return canRemoveMemberSafe('company', 'actor', targetUserId, assertedRole)
}

describe('Phase 04 — member-removal role must match persisted company authority', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.count.mockResolvedValue(2)
  })

  it.each(['WORKER', 'FINANCE', 'DISPATCHER', 'MANAGER'])(
    'rejects a %s spoofing COMPANY_OWNER privileges', async persistedRole => {
      const result = await check(persistedRole, 'COMPANY_OWNER')
      expect(result).toEqual({ allowed: false, reason: 'Insufficient permissions' })
      expect(mock.member).toHaveBeenCalledTimes(1)
    },
  )

  it('rejects a former owner whose persisted role was changed to manager', async () => {
    expect((await check('MANAGER', 'COMPANY_OWNER')).allowed).toBe(false)
  })

  it('rejects an owner who supplies a different role than their persisted role', async () => {
    expect((await check('COMPANY_OWNER', 'MANAGER')).allowed).toBe(false)
  })

  it('rejects deleted and inactive memberships', async () => {
    expect((await check(null)).allowed).toBe(false)
    expect(mock.member).toHaveBeenCalledWith({
      where: { companyId: 'company', userId: 'actor', status: 'ACTIVE' },
    })
  })

  it.each(['COMPANY_OWNER', 'MANAGER'] as const)(
    'still allows a genuine %s to remove a worker', async role => {
      expect(await check(role, role)).toEqual({ allowed: true })
    },
  )

  it('continues to block removing the final company owner', async () => {
    mock.member.mockImplementation(async ({ where }) =>
      where.userId === 'actor'
        ? { id: 'owner', role: 'COMPANY_OWNER' }
        : null,
    )
    mock.count.mockResolvedValue(1)
    const result = await canRemoveMemberSafe('company', 'actor', 'actor', 'COMPANY_OWNER')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('last owner')
  })
})
