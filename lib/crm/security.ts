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
  sessionId: string
  permissionOverrides: PermissionOverride[]
  /** Validated operator-selected market. ALL means every market allowed by the live staff assignment. */
  selectedMarket?: string
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

function forwardedValues(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function trustedRequestHosts(request: NextRequest): Set<string> {
  const hosts = new Set<string>()

  if (request.nextUrl.host) hosts.add(request.nextUrl.host.toLowerCase())

  for (const value of forwardedValues(request.headers.get('x-forwarded-host'))) {
    hosts.add(value.toLowerCase())
  }

  for (const value of forwardedValues(request.headers.get('host'))) {
    hosts.add(value.toLowerCase())
  }

  return hosts
}

function trustedRequestOrigins(request: NextRequest): Set<string> {
  const origins = new Set<string>([request.nextUrl.origin])
  const hosts = trustedRequestHosts(request)
  const protocols = new Set<string>()

  for (const value of forwardedValues(request.headers.get('x-forwarded-proto'))) {
    const protocol = value.toLowerCase().replace(/:$/, '')
    if (protocol === 'http' || protocol === 'https') protocols.add(protocol)
  }

  const nextProtocol = request.nextUrl.protocol.replace(/:$/, '').toLowerCase()
  if (nextProtocol === 'http' || nextProtocol === 'https') protocols.add(nextProtocol)

  for (const host of hosts) {
    for (const protocol of protocols) {
      try {
        origins.add(new URL(`${protocol}://${host}`).origin)
      } catch {
        // Ignore malformed proxy/host values. They must never make a request trusted.
      }
    }
  }

  return origins
}

export function isTrustedCrmMutationRequest(request: NextRequest): boolean {
  const method = request.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true

  // Bearer-token clients are not vulnerable to cookie-based CSRF.
  const authorization = request.headers.get('authorization')
  if (authorization?.startsWith('Bearer ')) return true

  const origin = request.headers.get('origin')
  if (!origin) return false

  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin') return false

  try {
    const parsedOrigin = new URL(origin)

    // Normal case: the browser origin matches the URL Next.js sees or the
    // public origin reconstructed from trusted reverse-proxy host/proto headers.
    if (trustedRequestOrigins(request).has(parsedOrigin.origin)) return true

    // Reverse proxies can terminate TLS and hand Next.js an internal HTTP URL.
    // A real browser's Sec-Fetch-Site: same-origin is computed before the proxy,
    // so when that signal is present we may safely tolerate a scheme mismatch
    // while still requiring the public host (and port, when present) to match.
    if (
      fetchSite === 'same-origin' &&
      trustedRequestHosts(request).has(parsedOrigin.host.toLowerCase())
    ) {
      return true
    }

    return false
  } catch {
    return false
  }
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

  // The operator market selector is an authorization scope, not a presentation hint.
  // Query/header takes precedence for explicit API calls; otherwise the CRM shell cookie
  // keeps all guarded reads and mutations on the same market after navigation/reload.
  const requestedMarket = (
    request.nextUrl.searchParams.get('market') ||
    request.headers.get('x-crm-market') ||
    request.cookies.get('maintainex_crm_market')?.value ||
    'ALL'
  ).trim().toUpperCase()

  if (requestedMarket !== 'ALL' && !/^[A-Z]{2}$/.test(requestedMarket)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'CRM_MARKET_INVALID', message: 'Invalid CRM market.' } },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      ),
    }
  }

  if (
    requestedMarket !== 'ALL' &&
    !isSuperAdmin &&
    !assignedCountries.includes(requestedMarket)
  ) {
    return deny(
      403,
      'CRM_MARKET_FORBIDDEN',
      'Selected market is outside the staff account scope.',
      request,
      { role, requestedMarket }
    )
  }

  if (requestedMarket !== 'ALL') {
    const country = await prisma.country.findUnique({
      where: { code: requestedMarket },
      select: { code: true },
    })
    if (!country) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: 'CRM_MARKET_UNKNOWN', message: 'Selected CRM market is not configured.' } },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        ),
      }
    }
  }

  return {
    ok: true,
    context: {
      adminId,
      email: liveAdmin.email,
      role,
      assignedCountries,
      isSuperAdmin,
      selectedMarket: requestedMarket,
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent'),
      sessionId: liveSession.id,
      permissionOverrides,
    },
  }
}

export type CrmCountryFilter = {
  id?: string
  countryCode?: { in: string[] }
}

export function getCrmCountryCodes(context: CrmSecurityContext): string[] | null {
  const selectedMarket = (context.selectedMarket || 'ALL').toUpperCase()
  if (selectedMarket !== 'ALL') return [selectedMarket]
  if (context.isSuperAdmin) return null
  return context.assignedCountries
}

export function getCrmCountryFilter(context: CrmSecurityContext): CrmCountryFilter {
  const countries = getCrmCountryCodes(context)
  if (countries === null) return {}
  if (countries.length === 0) return { id: '__NONE__' }
  return { countryCode: { in: countries } }
}

export function assertCrmCountryAllowed(
  context: CrmSecurityContext,
  countryCode: string | null | undefined
): boolean {
  if (!countryCode) return false
  const normalized = countryCode.toUpperCase()
  const countries = getCrmCountryCodes(context)
  if (countries === null) return true
  return countries.includes(normalized)
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
