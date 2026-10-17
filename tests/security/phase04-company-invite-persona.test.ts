import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mocks = vi.hoisted(() => ({
  role: 'TASKER',
  update: vi.fn(),
  accept: vi.fn(),
  inviteFindUnique: vi.fn(),
}))

vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => ({
    id: 'invited-user',
    name: 'Onboarding worker',
    email: 'worker@test.local',
    phone: null,
    role: mocks.role,
  }),
}))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/phase6/invitation', () => ({
  acceptCompanyInvite: mocks.accept,
}))
vi.mock('@/lib/phase6/audit', () => ({
  writeCompanyAuditLog: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { update: mocks.update },
    teamInvite: { findUnique: mocks.inviteFindUnique },
  },
}))

async function acceptRoute() {
  const { POST } = await import('@/app/api/mobile/company/team/accept/route')
  return POST(new NextRequest('http://localhost/api/mobile/company/team/accept', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'test-invite' }),
  }))
}

describe('Phase 04 — invitation acceptance must not erase individual-provider persona', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.role = 'TASKER'
    mocks.accept.mockResolvedValue({
      success: true,
      memberName: 'Onboarding worker',
      companyName: 'Company A',
    })
    mocks.inviteFindUnique.mockResolvedValue(null)
    mocks.update.mockResolvedValue({})
  })

  it('leaves a TASKER role intact after an accepted company invitation', async () => {
    const response = await acceptRoute()
    expect(response.status).toBe(200)
    expect(mocks.accept).toHaveBeenCalledOnce()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('keeps an already COMPANY account unchanged', async () => {
    mocks.role = 'COMPANY'
    const response = await acceptRoute()
    expect(response.status).toBe(200)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('keeps the existing customer-to-company onboarding behaviour', async () => {
    mocks.role = 'CUSTOMER'
    const response = await acceptRoute()
    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'invited-user' },
      data: { role: 'COMPANY' },
    })
  })

  it('sends taskers to their existing company-assignments screen', () => {
    const screen = readFileSync(resolve(process.cwd(), 'apps/mobile/features/company/screens/company-invite.tsx'), 'utf8')
    expect(screen).toContain("user?.role === 'TASKER' ? '/(tasker)/company-assignments' : '/(company)/(tabs)/dispatch'")
  })

  it('keeps membership-scoped permission checking rather than granting company ownership', () => {
    const handler = readFileSync(resolve(process.cwd(), 'app/api/mobile/company/team/accept/route.ts'), 'utf8')
    expect(handler).toContain("user.role !== 'TASKER' && user.role !== 'COMPANY'")
    expect(handler).not.toContain("data: { role: 'COMPANY' },\n    })")
  })
})
