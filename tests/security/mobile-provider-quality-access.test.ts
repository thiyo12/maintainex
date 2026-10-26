import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { authenticateRequest, calculateProviderQuality } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  calculateProviderQuality: vi.fn(),
}))

vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({ authenticateRequest }))
vi.mock('@/lib/quality-engine', () => ({ calculateProviderQuality }))

import { GET } from '@/app/api/mobile/v2/quality/route'

function request(query = '') {
  return new NextRequest(`https://maintainex.test/api/mobile/v2/quality${query}`)
}

describe('mobile provider quality authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateRequest.mockResolvedValue({ id: 'tasker-a', role: 'TASKER' })
    calculateProviderQuality.mockResolvedValue({ providerId: 'tasker-a', qualityScore: 88, isFlagged: false })
  })

  it('allows a tasker to calculate only their canonical profile', async () => {
    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(calculateProviderQuality).toHaveBeenCalledExactlyOnceWith('tasker-a')
  })

  it('allows an explicit self ID but never uses caller input as identity', async () => {
    const response = await GET(request('?providerId=tasker-a'))

    expect(response.status).toBe(200)
    expect(calculateProviderQuality).toHaveBeenCalledExactlyOnceWith('tasker-a')
  })

  it('rejects another provider before reading or updating their cached metrics', async () => {
    const response = await GET(request('?providerId=tasker-b'))

    expect(response.status).toBe(403)
    expect(calculateProviderQuality).not.toHaveBeenCalled()
  })

  it('rejects customers before invoking the quality service', async () => {
    authenticateRequest.mockResolvedValue({ id: 'customer-a', role: 'CUSTOMER' })

    const response = await GET(request())

    expect(response.status).toBe(403)
    expect(calculateProviderQuality).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated requests before invoking the quality service', async () => {
    authenticateRequest.mockResolvedValue(null)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(calculateProviderQuality).not.toHaveBeenCalled()
  })
})
