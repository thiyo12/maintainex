import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const m = vi.hoisted(() => ({
  guard: vi.fn(), country: vi.fn(), lookup: vi.fn(), review: vi.fn(), log: vi.fn(), transaction: vi.fn(),
}))
vi.mock('@/lib/crm/security', () => ({
  guardCrmRequest: m.guard,
  assertCrmCountryAllowed: m.country,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { marketplaceRiskEvent: { findUnique: m.lookup }, $transaction: m.transaction },
}))
vi.mock('@/lib/domain/admin-risk-event', () => ({
  CrewSafetyCaseRequiresDedicatedResolutionError: class CrewSafetyCaseRequiresDedicatedResolutionError extends Error {
    constructor() {
      super('Crew safety case requires dedicated resolution')
      this.name = 'CrewSafetyCaseRequiresDedicatedResolutionError'
    }
  },
  reviewRiskEvent: m.review,
}))
vi.mock('@/lib/shared/observability/secure-console', () => ({
  secureConsole: { error: m.log },
}))

const patch = async (resolution = 'NO_ACTION') => {
  const { PATCH } = await import('@/app/api/admin/risk-events/[id]/review/route')
  const request = new NextRequest('https://local.invalid/api/admin/risk-events/risk/review', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ resolution, reason: 'Valid review rationale' }),
  })
  return PATCH(request, { params: Promise.resolve({ id: 'risk' }) })
}

describe('Phase04 CRM risk event route never hides pending consumed-PIN holds', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.country.mockReturnValue(true)
    m.guard.mockResolvedValue({
      ok: true,
      context: {
        adminId: 'admin', email: 'staff@example.invalid',
        role: 'MANAGER', assignedCountries: ['LK'], ipAddress: '127.0.0.1',
      },
    })
    m.lookup.mockResolvedValue({ id: 'risk', job: { countryCode: 'LK' } })
    m.transaction.mockImplementation(async callback => callback({ marker: 'tx' }))
  })
  it('maps a dedicated-crew-safety guard to a bounded 409, not review success', async () => {
    const { CrewSafetyCaseRequiresDedicatedResolutionError } =
      await import('@/lib/domain/admin-risk-event')
    m.review.mockRejectedValue(new CrewSafetyCaseRequiresDedicatedResolutionError())
    for (const resolution of ['CONFIRMED', 'DISMISSED', 'ESCALATED', 'NO_ACTION']) {
      const response = await patch(resolution)
      expect(response.status).toBe(409)
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
      expect(await response.json()).toEqual({
        error: 'Crew safety case requires separate authorized support resolution',
      })
    }
    expect(m.review).toHaveBeenCalledTimes(4)
    expect(m.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    })
    expect(m.guard).toHaveBeenCalledWith(expect.any(NextRequest), {
      permission: 'risk_events:resolve', level: 'sensitive', requireCountryScope: true,
    })
    expect(m.log).not.toHaveBeenCalled()
  })
  it('denies unauthorized or out-of-country staff before reaching review mutation', async () => {
    m.guard.mockResolvedValueOnce({
      ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    })
    expect((await patch()).status).toBe(403)
    m.country.mockReturnValue(false)
    expect((await patch()).status).toBe(403)
    expect(m.review).not.toHaveBeenCalled()
  })
  it('leaves unrelated already-authorized CRM reviews functioning', async () => {
    m.review.mockResolvedValue({
      event: { id: 'risk', eventType: 'SUSPICIOUS_BID_PATTERN' },
      resolution: 'CONFIRMED',
    })
    const response = await patch('CONFIRMED')
    expect(response.status).toBe(200)
    expect((await response.json()).success).toBe(true)
  })
})
