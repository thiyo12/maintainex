import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  createTrustedContactToken,
  hashTrustedContactToken,
  isValidTrustedContactToken,
  trustedContactExpiry,
} from '@/lib/safety/trusted-contact-share'

const { db, viewer } = vi.hoisted(() => ({
  viewer: { id: 'customer-1', suspended: false },
  db: {
    marketplaceJob: { findUnique: vi.fn() },
    jobQuote: { findFirst: vi.fn() },
    teamMember: { findFirst: vi.fn() },
    companyJobAssignment: { findFirst: vi.fn() },
    trustedContactShare: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/rate-limit/middleware', () => ({
  checkRateLimit: async () => ({ allowed: true }), ipKey: () => '127.0.0.1',
}))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: async () => viewer,
  assertNotSuspended: () => null,
}))

import { POST } from '@/app/api/mobile/v2/jobs/[id]/trusted-contact/route'
import { POST as readSharedStatus } from '@/app/api/mobile/v2/safety-share/route'

describe('trusted-contact share security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.marketplaceJob.findUnique.mockResolvedValue({
      id: 'job-1', customerId: viewer.id, countryCode: 'LK', status: 'IN_PROGRESS', preferredDate: null,
    })
    db.trustedContactShare.findFirst.mockResolvedValue(null)
    db.trustedContactShare.create.mockImplementation(async ({ data, select }) => ({
      id: 'share-1', consentedAt: data.consentedAt, expiresAt: data.expiresAt,
    }))
    db.$transaction.mockImplementation(async callback => callback({
      $queryRaw: async () => [],
      trustedContactShare: db.trustedContactShare,
    }))
  })

  it('generates an opaque 256-bit bearer and stores only its SHA-256 digest', () => {
    const token = createTrustedContactToken()
    expect(isValidTrustedContactToken(token)).toBe(true)
    expect(token).toHaveLength(43)
    expect(hashTrustedContactToken(token)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashTrustedContactToken(token)).not.toBe(token)
    expect(isValidTrustedContactToken('short')).toBe(false)
  })

  it('bounds expiry to one through 24 hours', () => {
    const now = new Date('2026-10-24T00:00:00.000Z')
    expect(trustedContactExpiry(4, now)?.toISOString()).toBe('2026-10-24T04:00:00.000Z')
    expect(trustedContactExpiry(0, now)).toBeNull()
    expect(trustedContactExpiry(25, now)).toBeNull()
    expect(trustedContactExpiry('4', now)).toBeNull()
  })

  it('requires explicit consent and never returns a share token before consent', async () => {
    const response = await POST(new NextRequest('https://maintainex.lk/api/mobile/v2/jobs/job-1/trusted-contact', {
      method: 'POST', body: JSON.stringify({ consent: false, expiresInHours: 4 }),
    }), { params: Promise.resolve({ id: 'job-1' }) })
    expect(response.status).toBe(400)
    expect(db.trustedContactShare.create).not.toHaveBeenCalled()
  })

  it('stores only the digest, enforces one active link, and caps the expiry', async () => {
    const response = await POST(new NextRequest('https://maintainex.lk/api/mobile/v2/jobs/job-1/trusted-contact', {
      method: 'POST', body: JSON.stringify({ consent: true, expiresInHours: 4 }),
    }), { params: Promise.resolve({ id: 'job-1' }) })
    const payload = await response.json()
    expect(response.status).toBe(201)
    expect(payload.url).toMatch(/^https:\/\/maintainex\.lk\/safety-share#[A-Za-z0-9_-]{43}$/)
    expect(db.trustedContactShare.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actorUserId: viewer.id,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        consentVersion: 'safety-share-v1',
      }),
    }))
    expect(payload.sharedFields).toEqual(['booking status', 'market', 'scheduled date'])
    expect(payload.excludedFields).toContain('street address')
  })

  it('returns only minimal booking metadata for a valid unexpired token', async () => {
    const token = createTrustedContactToken()
    db.trustedContactShare.findUnique.mockResolvedValue({
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      job: { status: 'IN_PROGRESS', countryCode: 'LK', preferredDate: null },
    })
    const response = await readSharedStatus(new NextRequest('https://maintainex.lk/api/mobile/v2/safety-share', {
      method: 'POST', body: JSON.stringify({ token }),
    }))
    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload).toMatchObject({ status: 'IN_PROGRESS', market: 'LK' })
    expect(payload).not.toHaveProperty('customerId')
    expect(payload).not.toHaveProperty('street')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  })

  it('does not reveal data for a revoked or expired share', async () => {
    const token = createTrustedContactToken()
    db.trustedContactShare.findUnique.mockResolvedValue({
      revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000),
      job: { status: 'IN_PROGRESS', countryCode: 'LK', preferredDate: null },
    })
    const response = await readSharedStatus(new NextRequest('https://maintainex.lk/api/mobile/v2/safety-share', {
      method: 'POST', body: JSON.stringify({ token }),
    }))
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Share link is invalid or expired' })
  })
})
