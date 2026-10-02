import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMocks = vi.hoisted(() => ({
  adminFindUnique: vi.fn(),
  adminSessionFindUnique: vi.fn(),
}))

vi.mock('@/lib/auth/authentication/admin-auth', () => ({
  getAdminSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminUser: {
      findUnique: prismaMocks.adminFindUnique,
    },
    adminSession: {
      findUnique: prismaMocks.adminSessionFindUnique,
    },
  },
}))

vi.mock('@/lib/shared/rate-limit/middleware', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  ipKey: vi.fn(() => '127.0.0.1'),
}))

vi.mock('@/lib/security/events', () => ({
  emitSecurityEvent: vi.fn(),
}))

vi.mock('@/lib/auth/authorization/admin-rbac', () => ({
  getIp: vi.fn(() => '127.0.0.1'),
}))

import { getAdminSession } from '@/lib/auth/authentication/admin-auth'
import { checkRateLimit } from '@/lib/shared/rate-limit/middleware'
import {
  assertCrmCountryAllowed,
  guardCrmRequest,
  isTrustedCrmMutationRequest,
  redactCrmSensitiveData,
} from '@/lib/crm/security'
import { evaluateEffectivePermission } from '@/lib/crm/governance'

const mockedSession = vi.mocked(getAdminSession)
const mockedRateLimit = vi.mocked(checkRateLimit)

function liveAdmin(overrides: Record<string, unknown> = {}) {
  return {
    id: 'admin-1',
    email: 'manager@example.com',
    role: 'MANAGER',
    isActive: true,
    deletedAt: null,
    lockedUntil: null,
    assignedCountries: JSON.stringify(['LK']),
    permissionOverrides: [],
    ...overrides,
  }
}

function liveSession(adminUserId: string, id: string) {
  return {
    id,
    adminUserId,
    isRevoked: false,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  }
}

function request(
  method = 'GET',
  headers: Record<string, string> = {},
  url = 'https://maintainex.lk/api/admin/jobs'
) {
  return new NextRequest(url, { method, headers })
}

describe('CRM three-layer security', () => {
  it('allows safe read requests through the origin boundary', () => {
    expect(isTrustedCrmMutationRequest(request('GET'))).toBe(true)
  })

  it('allows same-origin cookie-authenticated mutations', () => {
    const req = request('PATCH', {
      origin: 'https://maintainex.lk',
      'sec-fetch-site': 'same-origin',
    })
    expect(isTrustedCrmMutationRequest(req)).toBe(true)
  })

  it('rejects cross-origin cookie-authenticated mutations', () => {
    const req = request('PATCH', {
      origin: 'https://evil.example',
      'sec-fetch-site': 'cross-site',
    })
    expect(isTrustedCrmMutationRequest(req)).toBe(false)
  })

  it('rejects cookie-authenticated mutations with no Origin header', () => {
    expect(isTrustedCrmMutationRequest(request('DELETE'))).toBe(false)
  })

  it('allows bearer-token mutations because they are not cookie-CSRF requests', () => {
    const req = request('POST', {
      authorization: 'Bearer test-token',
    })
    expect(isTrustedCrmMutationRequest(req)).toBe(true)
  })

  it('enforces the canonical role permission map', () => {
    expect(evaluateEffectivePermission({
      role: 'MANAGER',
      permission: 'jobs:manage',
      overrides: [],
    }).allowed).toBe(true)
    expect(evaluateEffectivePermission({
      role: 'SUPPORT',
      permission: 'jobs:manage',
      overrides: [],
    }).allowed).toBe(false)
  })

  it('recursively redacts secrets before CRM data is persisted or exposed', () => {
    const value = {
      email: 'admin@example.com',
      password: 'plaintext',
      nested: {
        merchantSecret: 'secret-value',
        token: 'jwt-value',
        safe: 'keep-me',
      },
      list: [{ apiKey: 'key-value' }],
    }

    expect(redactCrmSensitiveData(value)).toEqual({
      email: 'admin@example.com',
      password: '[REDACTED]',
      nested: {
        merchantSecret: '[REDACTED]',
        token: '[REDACTED]',
        safe: 'keep-me',
      },
      list: [{ apiKey: '[REDACTED]' }],
    })
  })

  it('fails closed when a non-super admin has no country assignment', async () => {
    mockedRateLimit.mockResolvedValueOnce({ allowed: true })
    mockedSession.mockResolvedValueOnce({
      sub: 'admin-1',
      sid: 'session-admin-1',
      email: 'manager@example.com',
      role: 'MANAGER',
      assignedCountries: ['CA'],
      type: 'access',
      firstName: 'Ops',
      lastName: 'Manager',
    } as any)
    prismaMocks.adminFindUnique.mockResolvedValueOnce(
      liveAdmin({ assignedCountries: '[]' })
    )
    prismaMocks.adminSessionFindUnique.mockResolvedValueOnce(
      liveSession('admin-1', 'session-admin-1')
    )

    const result = await guardCrmRequest(request('GET'), {
      permission: 'jobs:view',
      requireCountryScope: true,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(403)
  })

  it('builds a country-scoped context for permitted staff', async () => {
    mockedRateLimit.mockResolvedValueOnce({ allowed: true })
    mockedSession.mockResolvedValueOnce({
      sub: 'admin-2',
      sid: 'session-admin-2',
      email: 'old-role@example.com',
      role: 'SUPER_ADMIN',
      assignedCountries: ['CA'],
      type: 'access',
      firstName: 'Old',
      lastName: 'Claims',
    } as any)
    prismaMocks.adminFindUnique.mockResolvedValueOnce(
      liveAdmin({
        id: 'admin-2',
        email: 'manager@example.com',
        assignedCountries: '["lk"]',
      })
    )
    prismaMocks.adminSessionFindUnique.mockResolvedValueOnce(
      liveSession('admin-2', 'session-admin-2')
    )

    const result = await guardCrmRequest(request('GET'), {
      permission: 'jobs:view',
      requireCountryScope: true,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.context.adminId).toBe('admin-2')
      expect(result.context.assignedCountries).toEqual(['LK'])
      expect(assertCrmCountryAllowed(result.context, 'LK')).toBe(true)
      expect(assertCrmCountryAllowed(result.context, 'CA')).toBe(false)
    }
  })

  it('rejects a deactivated live admin even when the JWT is still valid', async () => {
    mockedRateLimit.mockResolvedValueOnce({ allowed: true })
    mockedSession.mockResolvedValueOnce({
      sub: 'admin-disabled',
      sid: 'session-admin-disabled',
      email: 'manager@example.com',
      role: 'MANAGER',
      assignedCountries: ['LK'],
      type: 'access',
      firstName: 'Old',
      lastName: 'Session',
    } as any)
    prismaMocks.adminFindUnique.mockResolvedValueOnce(
      liveAdmin({
        id: 'admin-disabled',
        isActive: false,
      })
    )
    prismaMocks.adminSessionFindUnique.mockResolvedValueOnce(
      liveSession('admin-disabled', 'session-admin-disabled')
    )

    const result = await guardCrmRequest(request('GET'), {
      permission: 'jobs:view',
      requireCountryScope: true,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  it('blocks a role that lacks the requested CRM permission', async () => {
    mockedRateLimit.mockResolvedValueOnce({ allowed: true })
    mockedSession.mockResolvedValueOnce({
      sub: 'admin-3',
      sid: 'session-admin-3',
      email: 'manager@example.com',
      role: 'MANAGER',
      assignedCountries: ['LK'],
      type: 'access',
      firstName: 'Old',
      lastName: 'Role',
    } as any)
    prismaMocks.adminFindUnique.mockResolvedValueOnce(
      liveAdmin({
        id: 'admin-3',
        email: 'support@example.com',
        role: 'SUPPORT',
      })
    )
    prismaMocks.adminSessionFindUnique.mockResolvedValueOnce(
      liveSession('admin-3', 'session-admin-3')
    )

    const result = await guardCrmRequest(request('GET'), {
      permission: 'jobs:manage',
      requireCountryScope: true,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(403)
  })

  it('honors an explicit live permission DENY override', async () => {
    mockedRateLimit.mockResolvedValueOnce({ allowed: true })
    mockedSession.mockResolvedValueOnce({
      sub: 'admin-deny',
      sid: 'session-admin-deny',
      email: 'manager@example.com',
      role: 'MANAGER',
      assignedCountries: ['LK'],
      type: 'access',
      firstName: 'Denied',
      lastName: 'Manager',
    } as any)
    prismaMocks.adminFindUnique.mockResolvedValueOnce(
      liveAdmin({
        id: 'admin-deny',
        role: 'MANAGER',
        permissionOverrides: [{ permission: 'jobs:manage', effect: 'DENY' }],
      })
    )
    prismaMocks.adminSessionFindUnique.mockResolvedValueOnce(
      liveSession('admin-deny', 'session-admin-deny')
    )

    const result = await guardCrmRequest(request('GET'), {
      permission: 'jobs:manage',
      requireCountryScope: true,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(403)
  })
})
