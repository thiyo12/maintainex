import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  existingMembership: null as null | { id: string; role: string; status: string },
  profileFindUnique: vi.fn(),
  memberFindFirst: vi.fn(),
  memberCreate: vi.fn(),
  memberUpdate: vi.fn(),
  profileUpdate: vi.fn(),
  resolveContext: vi.fn(),
}))

vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => ({
    id: 'company-owner', role: 'COMPANY', name: 'Owner', countryCode: 'LK',
  }),
}))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    companyProfile: {
      findUnique: mocks.profileFindUnique,
      update: mocks.profileUpdate,
    },
    teamMember: {
      findFirst: mocks.memberFindFirst,
      create: mocks.memberCreate,
      update: mocks.memberUpdate,
    },
  },
}))
vi.mock('@/lib/phase6/company-context', () => ({
  resolveCompanyContext: mocks.resolveContext,
}))

async function saveProfile(body: Record<string, unknown> = { companyName: 'Updated' }) {
  const { PUT } = await import('@/app/api/mobile/company/profile/route')
  return PUT(new NextRequest('http://localhost/api/mobile/company/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

describe('Phase 04 — company profile edits cannot reactivate or promote owner membership', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.existingMembership = null
    mocks.profileFindUnique.mockResolvedValue({ id: 'company', countryCode: 'LK' })
    mocks.memberFindFirst.mockImplementation(async () => mocks.existingMembership)
    mocks.profileUpdate.mockResolvedValue({ id: 'company', companyName: 'Updated' })
    mocks.resolveContext.mockResolvedValue({
      context: { companyId: 'company', membershipId: 'member', role: 'COMPANY_OWNER' },
    })
  })

  it('does not reactivate a suspended owner when saving the company profile', async () => {
    mocks.existingMembership = { id: 'member', role: 'COMPANY_OWNER', status: 'SUSPENDED' }
    mocks.resolveContext.mockResolvedValue({
      context: null,
      error: NextResponse.json({ error: 'Not a member of this company' }, { status: 403 }),
    })
    const response = await saveProfile()
    expect(response.status).toBe(403)
    expect(mocks.memberUpdate).not.toHaveBeenCalled()
    expect(mocks.profileUpdate).not.toHaveBeenCalled()
  })

  it('does not promote an existing demoted member back to company owner', async () => {
    mocks.existingMembership = { id: 'member', role: 'WORKER', status: 'ACTIVE' }
    mocks.resolveContext.mockResolvedValue({
      context: null,
      error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }),
    })
    const response = await saveProfile()
    expect(response.status).toBe(403)
    expect(mocks.memberUpdate).not.toHaveBeenCalled()
  })

  it('keeps legitimate active owner profile updates working', async () => {
    mocks.existingMembership = { id: 'member', role: 'COMPANY_OWNER', status: 'ACTIVE' }
    const response = await saveProfile()
    expect(response.status).toBe(200)
    expect(mocks.memberUpdate).not.toHaveBeenCalled()
    expect(mocks.profileUpdate).toHaveBeenCalledOnce()
  })

  it('still creates membership for a genuinely legacy owner with no member record', async () => {
    mocks.existingMembership = null
    const response = await saveProfile()
    expect(response.status).toBe(200)
    expect(mocks.memberCreate).toHaveBeenCalledWith({
      data: {
        companyId: 'company',
        userId: 'company-owner',
        name: 'Owner',
        role: 'COMPANY_OWNER',
        skills: '[]',
        status: 'ACTIVE',
      },
    })
    expect(mocks.memberUpdate).not.toHaveBeenCalled()
  })
})
