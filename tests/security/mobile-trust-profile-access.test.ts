import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { authenticateRequest, calculateCustomerTrust } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  calculateCustomerTrust: vi.fn(),
}))

vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({ authenticateRequest }))
vi.mock('@/lib/trust-engine', () => ({ calculateCustomerTrust }))

import { GET } from '@/app/api/mobile/v2/trust/route'

function request(query = '') {
  return new NextRequest(`https://maintainex.test/api/mobile/v2/trust${query}`)
}

describe('mobile customer trust profile authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateRequest.mockResolvedValue({ id: 'customer-a', role: 'CUSTOMER' })
    calculateCustomerTrust.mockResolvedValue({
      customerId: 'customer-a', trustScore: 1, level: 'normal', totalJobsPosted: 0,
      completedJobs: 0, cancelledJobs: 0, warnings: [],
    })
  })

  it('preserves authenticated self-access without a customerId parameter', async () => {
    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ customerId: 'customer-a' })
    expect(calculateCustomerTrust).toHaveBeenCalledExactlyOnceWith('customer-a')
  })

  it('allows an explicit self ID but resolves the profile from authenticated identity', async () => {
    const response = await GET(request('?customerId=customer-a'))

    expect(response.status).toBe(200)
    expect(calculateCustomerTrust).toHaveBeenCalledExactlyOnceWith('customer-a')
  })

  it('rejects another customer ID before invoking the trust service', async () => {
    const response = await GET(request('?customerId=customer-b'))

    expect(response.status).toBe(403)
    expect(calculateCustomerTrust).not.toHaveBeenCalled()
  })

  it('rejects non-customer roles before invoking the trust service', async () => {
    authenticateRequest.mockResolvedValue({ id: 'tasker-a', role: 'TASKER' })

    const response = await GET(request())

    expect(response.status).toBe(403)
    expect(calculateCustomerTrust).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated requests before invoking the trust service', async () => {
    authenticateRequest.mockResolvedValue(null)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(calculateCustomerTrust).not.toHaveBeenCalled()
  })
})
