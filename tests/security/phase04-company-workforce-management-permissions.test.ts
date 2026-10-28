import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { COMPANY_PERMISSIONS, hasCompanyPermission, type CompanyRole } from '@/lib/phase6/rbac'
import { resolveCompanyContext } from '@/lib/phase6/company-context'

const mocked = vi.hoisted(() => ({
  findFirst: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    teamMember: { findFirst: mocked.findFirst },
  },
}))
vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => ({ id: 'actor', isActive: true }),
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: vi.fn() }))

async function request(action: string) {
  const { PATCH } = await import('@/app/api/mobile/company/workforce/route')
  const response = await PATCH(new NextRequest('http://localhost/api/mobile/company/workforce', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ companyId: 'company', memberUserId: 'worker', action }),
  }))
  return { status: response.status, body: await response.json() }
}

describe('Phase 04 — real company workforce RBAC, no mocked context', () => {
  const actors: CompanyRole[] = [
    'COMPANY_OWNER', 'MANAGER', 'DISPATCHER', 'WORKER', 'FINANCE',
  ]
  beforeEach(() => {
    vi.resetAllMocks()
    mocked.findFirst.mockImplementation(async ({ where }) =>
      where.userId === 'actor'
        ? { id: 'actor-membership', companyId: 'company', role: 'COMPANY_OWNER' }
        : { id: 'worker-membership', companyId: 'company', role: 'WORKER', status: 'ACTIVE' }
    )
  })

  it('allows exactly owners and managers to manage workforce memberships', () => {
    for (const role of actors) {
      expect(hasCompanyPermission(role, 'members:manage')).toBe(
        role === 'COMPANY_OWNER' || role === 'MANAGER',
      )
    }
    expect(COMPANY_PERMISSIONS.DISPATCHER).not.toContain('members:manage')
    expect(COMPANY_PERMISSIONS.FINANCE).not.toContain('members:manage')
    expect(COMPANY_PERMISSIONS.WORKER).not.toContain('members:manage')
  })

  it.each(['COMPANY_OWNER', 'MANAGER'] as const)(
    '%s can resolve a real authorization context for workforce management',
    async role => {
      mocked.findFirst.mockResolvedValue({
        id: 'membership', companyId: 'company', role,
      })
      const { context, error } = await resolveCompanyContext('actor', 'company', 'members:manage')
      expect(error).toBeUndefined()
      expect(context).toEqual({ companyId: 'company', role, membershipId: 'membership' })
    },
  )

  it.each(['DISPATCHER', 'WORKER', 'FINANCE'] as const)(
    '%s cannot resolve a workforce management authorization context',
    async role => {
      mocked.findFirst.mockResolvedValue({
        id: 'membership', companyId: 'company', role,
      })
      const { context, error } = await resolveCompanyContext('actor', 'company', 'members:manage')
      expect(context).toBeNull()
      expect(error?.status).toBe(403)
    },
  )

  it.each(['COMPANY_OWNER', 'MANAGER'] as const)(
    'the real workforce PATCH passes the %s authorization check',
    async role => {
      mocked.findFirst.mockImplementation(async ({ where }) =>
        where.userId === 'actor'
          ? { id: 'member-actor', companyId: 'company', role }
          : { id: 'member-worker', companyId: 'company', role: 'WORKER', status: 'ACTIVE' },
      )
      const { status, body } = await request('unrecognized')
      // Invalid action is 400 only after authentication, RBAC and member lookup.
      expect(status).toBe(400)
      expect(body.error).toContain('Invalid action')
    },
  )

  it.each(['DISPATCHER', 'WORKER', 'FINANCE'] as const)(
    'the real workforce PATCH denies %s before looking up any target member',
    async role => {
      mocked.findFirst.mockResolvedValue({
        id: 'actor-membership', companyId: 'company', role,
      })
      const { status, body } = await request('unrecognized')
      expect(status).toBe(403)
      expect(body.error).toBe('Insufficient permissions')
      expect(mocked.findFirst).toHaveBeenCalledTimes(1)
    },
  )

  it('rejects a missing or removed owner membership', async () => {
    mocked.findFirst.mockResolvedValue(null)
    const { status } = await request('unrecognized')
    expect(status).toBe(403)
  })
})
