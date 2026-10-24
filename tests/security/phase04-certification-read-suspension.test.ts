import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mock = vi.hoisted(() => ({ suspended: false, read: vi.fn(), context: vi.fn() }))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: async () => ({ id: 'user', role: 'TASKER' }),
  assertNotSuspended: () => mock.suspended
    ? NextResponse.json({ error: 'Account suspended' }, { status: 403 })
    : null,
}))
vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => ({ id: 'user', role: 'COMPANY' }),
}))
vi.mock('@/lib/phase6/company-context', () => ({
  resolveCompanyContext: mock.context,
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: { $queryRawUnsafe: mock.read },
}))

async function read(holder: 'INDIVIDUAL' | 'COMPANY') {
  const path = holder === 'INDIVIDUAL'
    ? '/api/mobile/v2/certifications'
    : '/api/mobile/company/certifications?companyId=company'
  const { GET } = holder === 'INDIVIDUAL'
    ? await import('@/app/api/mobile/v2/certifications/route')
    : await import('@/app/api/mobile/company/certifications/route')
  const response = await GET(new NextRequest('http://localhost' + path))
  return { status: response.status, body: await response.json() }
}

describe('Phase 04 — suspended accounts cannot read sensitive provider certifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.suspended = false
    mock.read.mockResolvedValue([{ id: 'cert' }])
    mock.context.mockResolvedValue({
      context: { companyId: 'company', role: 'COMPANY_OWNER' }, error: null,
    })
  })

  it.each(['INDIVIDUAL', 'COMPANY'] as const)(
    'blocks a suspended %s credential reader before hitting the database',
    async holder => {
      mock.suspended = true
      const result = await read(holder)
      expect(result.status).toBe(403)
      expect(result.body.error).toContain('suspended')
      expect(mock.read).not.toHaveBeenCalled()
      expect(mock.context).not.toHaveBeenCalled()
    },
  )

  it.each(['INDIVIDUAL', 'COMPANY'] as const)(
    'preserves valid authenticated %s credential reads',
    async holder => {
      const result = await read(holder)
      expect(result.status).toBe(200)
      expect(result.body.certifications).toEqual([{ id: 'cert' }])
      expect(mock.read).toHaveBeenCalledTimes(1)
      if (holder === 'COMPANY') {
        expect(mock.context).toHaveBeenCalledWith('user', 'company', 'certifications:read')
      }
    },
  )
})
