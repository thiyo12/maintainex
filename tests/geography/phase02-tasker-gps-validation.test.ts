import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mock = vi.hoisted(() => ({
  currentUser: { id: 'tasker-1', role: 'TASKER' } as { id: string; role: string } | null,
  suspended: false,
  update: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { taskerProfile: { update: mock.update } },
}))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: async () => mock.currentUser,
  assertNotSuspended: () => mock.suspended
    ? NextResponse.json({ error: 'Suspended' }, { status: 403 }) : null,
}))

async function put(body: unknown) {
  const { PUT } = await import('@/app/api/mobile/taskers/location/route')
  return PUT(new NextRequest('http://localhost/api/mobile/taskers/location', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

describe('Phase 02 — tasker GPS writes reject corrupt coordinates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.currentUser = { id: 'tasker-1', role: 'TASKER' }
    mock.suspended = false
    mock.update.mockResolvedValue({ id: 'profile-1' })
  })

  it('saves a valid Sri Lankan coordinate pair without changing the values', async () => {
    expect((await put({ latitude: 6.9271, longitude: 79.8612 })).status).toBe(200)
    expect(mock.update).toHaveBeenCalledWith({
      where: { userId: 'tasker-1' },
      data: {
        latitude: 6.9271, longitude: 79.8612,
        locationUpdatedAt: expect.any(Date),
      },
    })
  })

  it('continues to accept decimal strings sent by older mobile clients', async () => {
    expect((await put({ latitude: ' 49.2827 ', longitude: ' -123.1207 ' })).status).toBe(200)
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ latitude: 49.2827, longitude: -123.1207 }),
    }))
  })

  it('rejects omitted longitude without modifying the stored location', async () => {
    expect((await put({ latitude: 6.9271 })).status).toBe(400)
    expect(mock.update).not.toHaveBeenCalled()
  })

  it.each([
    [{ latitude: null, longitude: 79.8612 }, 'null latitude'],
    [{ latitude: 6.9271, longitude: null }, 'null longitude'],
    [{ latitude: '', longitude: 79.8612 }, 'empty string'],
    [{ latitude: '   ', longitude: 79.8612 }, 'whitespace'],
    [{ latitude: true, longitude: 79.8612 }, 'boolean'],
    [{ latitude: false, longitude: 79.8612 }, 'false boolean'],
    [{ latitude: [], longitude: 79.8612 }, 'array'],
    [{ latitude: {}, longitude: 79.8612 }, 'object'],
    [{ latitude: '0x10', longitude: 79.8612 }, 'hexadecimal'],
    [{ latitude: 'NaN', longitude: 79.8612 }, 'invalid number string'],
    [{ latitude: 90.01, longitude: 79.8612 }, 'latitude outside range'],
    [{ latitude: 6.9271, longitude: -180.01 }, 'longitude outside range'],
  ])('rejects %s (%s) before writing any location', async (payload) => {
    const response = await put(payload)
    expect(response.status).toBe(400)
    expect(mock.update).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated callers before updating a location', async () => {
    mock.currentUser = null
    expect((await put({ latitude: 6.9271, longitude: 79.8612 })).status).toBe(401)
    expect(mock.update).not.toHaveBeenCalled()
  })

  it('rejects users without the TASKER role', async () => {
    mock.currentUser = { id: 'customer-1', role: 'CUSTOMER' }
    expect((await put({ latitude: 6.9271, longitude: 79.8612 })).status).toBe(401)
    expect(mock.update).not.toHaveBeenCalled()
  })

  it('rejects suspended providers before changing coordinates', async () => {
    mock.suspended = true
    expect((await put({ latitude: 6.9271, longitude: 79.8612 })).status).toBe(403)
    expect(mock.update).not.toHaveBeenCalled()
  })
})
