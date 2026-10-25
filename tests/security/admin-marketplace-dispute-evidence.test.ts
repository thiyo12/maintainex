import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  allowed: true,
  dispute: vi.fn(),
  evidence: vi.fn(),
  log: vi.fn(),
}))

vi.mock('@/lib/crm/security', () => ({
  guardCrmRequest: mocks.guard,
  assertCrmCountryAllowed: () => mocks.allowed,
  getCrmCountryFilter: vi.fn(() => ({ countryCode: 'LK' })),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    marketplaceDispute: { findUnique: mocks.dispute },
    jobEvidence: { findMany: mocks.evidence },
  },
}))
vi.mock('@/lib/shared/observability/secure-console', () => ({
  secureConsole: { error: mocks.log },
}))
vi.mock('@/lib/crm/audit', () => ({ createAuditLog: vi.fn() }))
vi.mock('@/lib/finance/escrow/escrow-service', () => ({
  completeAndReleaseEscrow: vi.fn(), refundEscrow: vi.fn(),
}))
vi.mock('@/lib/shared/money/money', () => ({
  getCurrencyForCountry: vi.fn(() => 'LKR'),
  minorUnitsToMajorUnits: vi.fn(() => 0),
}))
vi.mock('@/lib/notifications', () => ({
  notifyDisputeResolved: vi.fn(), notifyPaymentReleased: vi.fn(),
  notifyCashJobCompleted: vi.fn(), notifyCashDisputeResolved: vi.fn(),
}))

import { GET } from '@/app/api/admin/disputes/route'

function request(id = 'case-1') {
  return GET(new NextRequest(`https://maintainex.test/api/admin/disputes?evidenceDisputeId=${id}`))
}

describe('Admin marketplace dispute evidence access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.allowed = true
    mocks.guard.mockResolvedValue({ ok: true, context: { adminId: 'finance-1', selectedMarket: 'LK' } })
    mocks.dispute.mockResolvedValue({
      id: 'case-1', jobId: 'job-1', countryCode: 'LK', job: { countryCode: 'LK' },
    })
    mocks.evidence.mockResolvedValue([
      {
        id: 'evidence-1', uploaderType: 'CUSTOMER', evidenceType: 'NOTE',
        url: null, description: 'Synthetic test evidence', mimeType: null,
        createdAt: new Date('2026-10-25T00:00:00.000Z'), uploaderId: 'private-user',
      },
    ])
  })

  it('requires country-scoped dispute read permission before accessing evidence', async () => {
    mocks.guard.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) })
    expect((await request()).status).toBe(403)
    expect(mocks.dispute).not.toHaveBeenCalled()
    expect(mocks.evidence).not.toHaveBeenCalled()
  })

  it('denies evidence access outside the staff member country scope', async () => {
    mocks.allowed = false
    expect((await request()).status).toBe(403)
    expect(mocks.evidence).not.toHaveBeenCalled()
  })

  it('returns minimal case evidence without uploader identity or unrelated fields', async () => {
    const response = await request()
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(mocks.evidence).toHaveBeenCalledWith(expect.objectContaining({
      where: { jobId: 'job-1' },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: expect.not.objectContaining({ uploaderId: true }),
    }))
    const body = await response.json()
    expect(body.evidence).toHaveLength(1)
    expect(body.evidence[0]).not.toHaveProperty('uploaderId')
    expect(body.evidence[0].description).toBe('Synthetic test evidence')
  })
})
