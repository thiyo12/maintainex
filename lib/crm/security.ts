import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/authentication/admin-auth'
import { ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-types'
import { checkRateLimit, ipKey } from '@/lib/shared/rate-limit/middleware'
import type { RateLimitPolicy } from '@/lib/shared/rate-limit/store'
import { emitSecurityEvent } from '@/lib/security/events'
import { getIp } from '@/lib/auth/authorization/admin-rbac'
import { prisma } from '@/lib/prisma'
import { evaluateActionInitiation, evaluateEffectivePermission, type PermissionOverride } from '@/lib/crm/governance/permissions'
import { getCrmAction } from '@/lib/crm/governance/action-registry'
import type { CrmActionId, PermissionClass } from '@/lib/crm/governance/types'

export type CrmSecurityLevel = 'read' | 'mutation' | 'sensitive'

export interface CrmSecurityContext {
  adminId: string
  email: string
  role: AdminRole
  assignedCountries: string[]
  isSuperAdmin: boolean
  ipAddress: string
  userAgent: string | null
  permissionOverrides: PermissionOverride[]
}

export interface CrmGuardOptions {
  permission?: string
  allowedRoles?: AdminRole[]
  level?: CrmSecurityLevel
  requireCountryScope?: boolean
  permissionClass?: PermissionClass
}

export type CrmGuardResult =
  | { ok: true; context: CrmSecurityContext }
  | { ok: false; response: NextResponse }

const CRM_RATE_LIMITS: Record<CrmSecurityLevel, RateLimitPolicy> = {
  read: {
    name: 'crm_read',
    limit: 180,
    windowMs: 60_000,
    failureMode: 'fail-open',
    riskLevel: 'low',
  },
  mutation: {
    name: 'crm_mutation',
    limit: 40,
    windowMs: 60_000,
    failureMode: 'fail-closed',
    riskLevel: 'high',
  },
  sensitive: {
    name: 'crm_sensitive',
    limit: 10,
    windowMs: 60_000,
    failureMode: 'fail-closed',
    riskLevel: 'critical',
  },
}

const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'hash',
  'secret',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'jwt',
  'otp',
  'otphash',
  'otp_hash',
  'merchantsecret',
  'merchant_secret',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
])

function normalizedActorId(session: any): string | null {
  return session?.adminUserId || session?.id || session?.sub || null
}

function normalizeCountryValues(value: unknown): string[] {
  let raw: unknown[] = []

  if (Array.isArray(value)) {
    raw = value
  } else if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      raw = Array.isArray(parsed) ? parsed : value.split(',')
    } catch {
      raw = value.split(',')
    }
  }

  return [...new Set(
    raw
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim().toUpperCase())
      .filter(item => /^[A-Z]{2}$/.test(item))
  )]
}

function normalizedCountries(session: any): string[] {
  return normalizeCountryValues(session?.assignedCountries)
}

export function crmHasPermission(role: AdminRole, permission?: string): boolean {
  if (!permission) return true
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function isTrustedCrmMutationRequest(request: NextRequest): boolean {
  const method = request.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true

  // Bearer-token clients are not vulnerable to cookie-based CSRF.
  const authorization = request.headers.get('authorization')
  if (authorization?.startsWith('Bearer ')) return true

  const origin = request.headers.get('origin')
  if (!origin) return false

  try {
    const parsedOrigin = new URL(origin)
    if (parsedOrigin.origin !== request.nextUrl.origin) return false
  } catch {
    return false
  }

  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin') return false

  return true
}

export function redactCrmSensitiveData<T>(value: T): T {
  const seen = new WeakSet<object>()

  function walk(input: unknown, key?: string): unknown {
    if (key && SENSITIVE_FIELD_NAMES.has(key.toLowerCase())) {
      return '[REDACTED]'
    }

    if (input === null || input === undefined) return input
    if (typeof input !== 'object') return input

    if (input instanceof Date) return input
    if (seen.has(input as object)) return '[CIRCULAR]'
    seen.add(input as object)

    if (Array.isArray(input)) {
      return input.map(item => walk(item))
    }

    const output: Record<string, unknown> = {}
    for (const [childKey, childValue] of Object.entries(input as Record<string, unknown>)) {
      output[childKey] = walk(childValue, childKey)
    }
    return output
  }

  return walk(value) as T
}

function deny(
  status: number,
  code: string,
  message: string,
  request: NextRequest,
  details?: Record<string, unknown>
): CrmGuardResult {
  emitSecurityEvent({
    type: 'unauthorized_access_attempt',
    actorType: 'admin',
    ip: getIp(request),
    userAgent: request.headers.get('user-agent') || undefined,
    details: {
      path: request.nextUrl.pathname,
      method: request.method,
      code,
      ...details,
    },
  })

  return {
    ok: false,
    response: NextResponse.json(
      { error: { code, message } },
      {
        status,
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    ),
  }
}

/**
 * Three-layer CRM security gate.
 *
 * Layer 1 — request boundary:
 *   IP rate limiting + same-origin CSRF protection for cookie-authenticated writes.
 *
 * Layer 2 — identity and authorization:
 *   canonical admin session + role permission + assigned-country fail-closed scope.
 *
 * Layer 3 — data/action safety:
 *   callers must validate request payloads, use redactCrmSensitiveData for exposed
 *   objects, and audit sensitive mutations through the canonical audit service.
 */
export async function guardCrmRequest(
  request: NextRequest,
  options: CrmGuardOptions = {}
): Promise<CrmGuardResult> {
  const level = options.level || (request.method === 'GET' ? 'read' : 'mutation')

  // Layer 1A — rate limit at the CRM boundary.
  const rateLimit = await checkRateLimit(request, {
    keyPrefix: `crm:${level}`,
    identifier: ipKey(request),
    policy: CRM_RATE_LIMITS[level],
  })

  if (!rateLimit.allowed) {
    return {
      ok: false,
      response:
        rateLimit.response ||
        NextResponse.json(
          { error: { code: 'RATE_LIMITED', message: 'Too many CRM requests.' } },
          { status: 429 }
        ),
    }
  }

  // Layer 1B — block cross-origin cookie-authenticated writes.
  if (!isTrustedCrmMutationRequest(request)) {
    return deny(403, 'CRM_ORIGIN_REJECTED', 'Cross-origin CRM mutation rejected.', request)
  }

  // Layer 2A — cryptographically valid staff identity.
  const session: any = await getAdminSession(request)
  const adminId = normalizedActorId(session)

  if (!session || !adminId) {
    return deny(401, 'CRM_UNAUTHENTICATED', 'Admin authentication required.', request)
  }

  const sessionId =
    typeof session?.sid === 'string'
      ? session.sid
      : typeof session?.sessionId === 'string'
        ? session.sessionId
        : null

  if (!sessionId) {
    return deny(401, 'CRM_SESSION_REQUIRED', 'A current admin session is required.', request)
  }

  // Layer 2B — live canonical staff + session state.
  //
  // Never authorize CRM access only from JWT claims. Role/country changes,
  // deactivation, logout and explicit session revocation must take effect
  // immediately instead of waiting for access-token expiry.
  const [liveAdmin, liveSession] = await Promise.all([
    prisma.adminUser.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        deletedAt: true,
        lockedUntil: true,
        assignedCountries: true,
        permissionOverrides: {
          select: { permission: true, effect: true },
        },
      },
    }),
    prisma.adminSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        adminUserId: true,
        isRevoked: true,
        expiresAt: true,
      },
    }),
  ])

  if (
    !liveAdmin ||
    !liveAdmin.isActive ||
    liveAdmin.deletedAt ||
    (liveAdmin.lockedUntil && liveAdmin.lockedUntil > new Date())
  ) {
    return deny(401, 'CRM_ACCOUNT_INACTIVE', 'Admin account is not active.', request)
  }

  if (
    !liveSession ||
    liveSession.adminUserId !== adminId ||
    liveSession.isRevoked ||
    liveSession.expiresAt <= new Date()
  ) {
    return deny(401, 'CRM_SESSION_REVOKED', 'Admin session is expired or revoked.', request)
  }

  const role = liveAdmin.role as AdminRole
  if (!(role in ROLE_PERMISSIONS)) {
    return deny(403, 'CRM_ROLE_INVALID', 'Admin role is not recognized.', request)
  }

  if (options.allowedRoles && !options.allowedRoles.includes(role)) {
    return deny(403, 'CRM_ROLE_FORBIDDEN', 'Admin role is not permitted for this action.', request, {
      role,
    })
  }

  const permissionOverrides: PermissionOverride[] = (liveAdmin.permissionOverrides || [])
    .filter((item: { permission: string; effect: string }) => item.effect === 'ALLOW' || item.effect === 'DENY')
    .map((item: { permission: string; effect: string }) => ({
      permission: item.permission,
      effect: item.effect as PermissionOverride['effect'],
    }))

  if (options.permission) {
    const permission = evaluateEffectivePermission({
      role,
      permission: options.permission,
      permissionClass: options.permissionClass,
      overrides: permissionOverrides,
    })
    if (!permission.allowed) {
      return deny(403, 'CRM_PERMISSION_FORBIDDEN', 'Missing CRM permission.', request, {
        role,
        permission: options.permission,
        source: permission.source,
      })
    }
  }

  // Layer 2C — fail closed on the live assigned-country scope.
  const assignedCountries = normalizeCountryValues(liveAdmin.assignedCountries)
  const isSuperAdmin = role === 'SUPER_ADMIN'
  if (options.requireCountryScope && !isSuperAdmin && assignedCountries.length === 0) {
    return deny(
      403,
      'CRM_COUNTRY_SCOPE_REQUIRED',
      'No country is assigned to this admin account.',
      request,
      { role }
    )
  }

  return {
    ok: true,
    context: {
      adminId,
      email: liveAdmin.email,
      role,
      assignedCountries,
      isSuperAdmin,
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent'),
      permissionOverrides,
    },
  }
}

export type CrmCountryFilter = {
  id?: string
  countryCode?: { in: string[] }
}

export function getCrmCountryFilter(context: CrmSecurityContext): CrmCountryFilter {
  if (context.isSuperAdmin) return {}
  if (context.assignedCountries.length === 0) return { id: '__NONE__' }
  return { countryCode: { in: context.assignedCountries } }
}

export function assertCrmCountryAllowed(
  context: CrmSecurityContext,
  countryCode: string | null | undefined
): boolean {
  if (context.isSuperAdmin) return true
  if (!countryCode) return false
  return context.assignedCountries.includes(countryCode.toUpperCase())
}


export interface CrmActionGuardOptions {
  level?: CrmSecurityLevel
}

export async function guardCrmAction(
  request: NextRequest,
  actionId: CrmActionId,
  options: CrmActionGuardOptions = {}
): Promise<CrmGuardResult> {
  const action = getCrmAction(actionId)
  const guard = await guardCrmRequest(request, {
    level: options.level || 'sensitive',
    requireCountryScope: action.requiresMarketScope,
  })
  if (!guard.ok) return guard

  const access = evaluateActionInitiation({
    role: guard.context.role,
    actionId,
    overrides: guard.context.permissionOverrides,
  })

  if (!access.allowed) {
    return deny(
      403,
      'CRM_ACTION_FORBIDDEN',
      'Staff account is not permitted to initiate this CRM action.',
      request,
      {
        role: guard.context.role,
        actionId,
        permission: action.initiatePermission,
        source: access.source,
      }
    )
  }

  return guard
}
