import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return secret
}

const securityHeaders: Record<string, string> = {
  'X-DNS-Prefetch-Control': 'on',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.cloudinary.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://res.cloudinary.com https://*.cloudinary.com; connect-src 'self' https://api.cloudinary.com; frame-ancestors 'none'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
}

const coconutSecurityHeaders: Record<string, string> = {
  ...securityHeaders,
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
}

const RATE_LIMITS: Record<string, { maxRequests: number; windowSeconds: number }> = {
  default: { maxRequests: 100, windowSeconds: 60 },
  auth: { maxRequests: 5, windowSeconds: 60 },
  admin: { maxRequests: 200, windowSeconds: 60 },
}

function b64UrlDecode(str: string): string {
  const lookup = new Uint8Array([
    62,62,62,62,62,62,62,62,62,62,62,62,62,62,62,62,
    62,62,62,62,62,62,62,62,62,62,62,62,62,62,62,62,
    62,62,62,62,62,62,62,62,62,62,62,62,62,63,62,62,
    52,53,54,55,56,57,58,59,60,61,62,62,62,0,62,62,
    62,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,
    15,16,17,18,19,20,21,22,23,24,25,62,62,62,62,62,
    62,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
    41,42,43,44,45,46,47,48,49,50,51,62,62,62,62,62,
  ])
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  const len = b64.length
  const out: number[] = []
  for (let i = 0; i < len; i += 4) {
    const a = lookup[b64.charCodeAt(i)]
    const b = lookup[b64.charCodeAt(i + 1)]
    const c = b64.charCodeAt(i + 2) === 61 ? -1 : lookup[b64.charCodeAt(i + 2)]
    const d = b64.charCodeAt(i + 3) === 61 ? -1 : lookup[b64.charCodeAt(i + 3)]
    out.push((a << 2) | (b >> 4))
    if (c >= 0) out.push(((b & 15) << 4) | (c >> 2))
    if (d >= 0) out.push(((c & 3) << 6) | d)
  }
  return new TextDecoder().decode(new Uint8Array(out))
}

async function verifyJwtSignature(headerB64: string, payloadB64: string, signatureB64: string): Promise<boolean> {
  try {
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(getJwtSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    return await crypto.subtle.verify('HMAC', key, signature, data)
  } catch {
    return false
  }
}

async function verifySimpleToken(token: string): Promise<any> {
  try {
    const parts = token.split('.')
    if (parts.length === 3) {
      const [headerB64, payloadB64, signatureB64] = parts
      const signatureValid = await verifyJwtSignature(headerB64, payloadB64, signatureB64)
      if (!signatureValid) return null
      const payload = JSON.parse(b64UrlDecode(payloadB64))
      if (payload.exp && Date.now() / 1000 > payload.exp) return null
      return {
        id: payload.sub || payload.id,
        email: payload.email,
        role: payload.role,
        name: [payload.firstName, payload.lastName].filter(Boolean).join(' ') || payload.name || null,
        branchId: payload.branchId || null,
        province: payload.province || null,
        region: payload.region || null,
        canEditServices: payload.canEditServices || false,
        authType: payload.authType || 'admin',
      }
    }
    const [encoded, legacySig] = parts
    if (!encoded) return null
    const expectedSig = Buffer.from(getJwtSecret() + encoded).toString('base64').slice(0, 32)
    if (legacySig !== expectedSig) return null
    const payload = JSON.parse(b64UrlDecode(encoded))
    const maxAge = 30 * 24 * 60 * 60 * 1000
    if (Date.now() - payload.created > maxAge) return null
    return payload
  } catch {
    return null
  }
}

async function getSession(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const payload = await verifySimpleToken(token)
    if (payload && payload.id && payload.email && payload.role) {
      return {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        branchId: payload.branchId || null,
        province: payload.province || null,
        region: payload.region || null,
        name: payload.name || null,
        canEditServices: payload.canEditServices || false,
        authType: payload.authType || 'admin',
      }
    }
  }
  const token = request.cookies.get('admin_token')?.value
  if (!token) return null
  const payload = await verifySimpleToken(token)
  if (!payload) return null
  return {
    id: payload.id,
    email: payload.email,
    role: payload.role,
    branchId: payload.branchId,
    province: payload.province || null,
    region: payload.region || null,
    name: payload.name,
    canEditServices: payload.canEditServices || false,
    authType: payload.authType || 'admin',
  }
}

const IP_BLOCKLIST = new Set<string>()
const ipBlocklistExpiry = new Map<string, number>()
let lastBlocklistSync = 0
const BLOCKLIST_SYNC_INTERVAL = 60000

function getInternalSyncSecret(): string {
  if (!process.env.INTERNAL_SYNC_SECRET) throw new Error('[SECURITY] INTERNAL_SYNC_SECRET env var is required')
  return process.env.INTERNAL_SYNC_SECRET
}

async function syncIPBlocklist(request: NextRequest) {
  const now = Date.now()
  if (now - lastBlocklistSync < BLOCKLIST_SYNC_INTERVAL) return
  lastBlocklistSync = now
  try {
    const url = new URL('/api/internal/security/ip-blocklist', request.url)
    const resp = await fetch(url.toString(), {
      headers: { 'x-internal-sync': getInternalSyncSecret() },
      cache: 'no-store',
    })
    if (resp.ok) {
      const data = await resp.json()
      IP_BLOCKLIST.clear()
      ipBlocklistExpiry.clear()
      if (data.blockedIPs) {
        for (const entry of data.blockedIPs) {
          IP_BLOCKLIST.add(entry.ip)
          if (entry.expiresAt) {
            ipBlocklistExpiry.set(entry.ip, new Date(entry.expiresAt).getTime())
          }
        }
      }
    }
  } catch {}
}

function isIpBlocked(ip: string): boolean {
  const expiry = ipBlocklistExpiry.get(ip)
  if (expiry !== undefined) {
    if (Date.now() > expiry) {
      IP_BLOCKLIST.delete(ip)
      ipBlocklistExpiry.delete(ip)
      return false
    }
  }
  return IP_BLOCKLIST.has(ip)
}

const AI_CRAWLER_AGENTS = [
  'GPTBot', 'Google-Extended', 'CCBot', 'PerplexityBot',
  'Claude-Web', 'ClaudeBot', 'anthropic-ai', 'cohere-ai',
  'Bytespider', 'Applebot-Extended', 'FacebookBot',
  'Amazonbot', 'YouBot', 'Meltwater', 'omgili',
  'ChatGPT-User', 'OAI-SearchBot',
]

function isAiCrawler(request: NextRequest): boolean {
  const ua = request.headers.get('user-agent') || ''
  return AI_CRAWLER_AGENTS.some(agent => ua.includes(agent))
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

function applyRateLimitHeaders(response: NextResponse, remaining: number, resetAt: Date): NextResponse {
  response.headers.set('X-RateLimit-Remaining', remaining.toString())
  response.headers.set('X-RateLimit-Reset', Math.floor(resetAt.getTime() / 1000).toString())
  return response
}

function applyCoconutHeaders(response: NextResponse, remaining: number, resetAt: Date): NextResponse {
  Object.entries(coconutSecurityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  response.headers.set('X-RateLimit-Remaining', remaining.toString())
  response.headers.set('X-RateLimit-Reset', Math.floor(resetAt.getTime() / 1000).toString())
  return response
}

const inMemoryRateLimit = new Map<string, { count: number; windowStart: number }>()

function getInMemoryRateLimit(ip: string, limitType: string): { remaining: number; resetAt: Date; limited: boolean } {
  const config = RATE_LIMITS[limitType] || RATE_LIMITS.default
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  const windowStart = now - (now % windowMs)
  const key = `${ip}:${limitType}:${windowStart}`
  const entry = inMemoryRateLimit.get(key)
  if (!entry || entry.windowStart !== windowStart) {
    inMemoryRateLimit.set(key, { count: 1, windowStart })
    return { remaining: config.maxRequests - 1, resetAt: new Date(windowStart + windowMs), limited: false }
  }
  entry.count++
  const remaining = Math.max(0, config.maxRequests - entry.count)
  return { remaining, resetAt: new Date(windowStart + windowMs), limited: remaining <= 0 }
}

if (typeof globalThis.__rateLimitCleanup === 'undefined') {
  globalThis.__rateLimitCleanup = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of inMemoryRateLimit.entries()) {
      if (now - entry.windowStart > 120000) {
        inMemoryRateLimit.delete(key)
      }
    }
  }, 60000)
}

declare global {
  var __rateLimitCleanup: ReturnType<typeof setInterval> | undefined
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isAiCrawler(request)) {
    const response = NextResponse.next()
    response.headers.set('X-Robots-Tag', 'all')
    response.headers.set('Cache-Control', 'public, max-age=3600')
    return applySecurityHeaders(response)
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
             request.headers.get('x-real-ip') ||
             'unknown'

  await syncIPBlocklist(request)

  if (isIpBlocked(ip)) {
    return new NextResponse(
      JSON.stringify({ error: 'Access denied', code: 'IP_BLOCKED' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const isLoginRoute = pathname.startsWith('/api/admin/auth')
  const rateLimitType = isLoginRoute ? 'auth' : 'admin'
  const rateLimit = getInMemoryRateLimit(ip, rateLimitType)

  if (rateLimit.limited) {
    return new NextResponse(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000).toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.floor(rateLimit.resetAt.getTime() / 1000).toString(),
        },
      }
    )
  }

  let response: NextResponse

  if (pathname.startsWith('/admin/login') || pathname.startsWith('/admin/api/auth')) {
    response = NextResponse.next()
    return applyCoconutHeaders(response, rateLimit.remaining, rateLimit.resetAt)
  }

  if (pathname.startsWith('/api/seed/')) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse(
        JSON.stringify({ error: 'Not available in production' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }
    response = NextResponse.next()
    return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
  }

  if (pathname.startsWith('/setup') || pathname.startsWith('/api/industries/init')) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse(
        JSON.stringify({ error: 'Not available in production' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }
    const session = await getSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      response = NextResponse.redirect(loginUrl)
      return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
    }
    response = NextResponse.next()
    return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
  }

  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const session = await getSession(request)
    if (!session) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      response = NextResponse.redirect(loginUrl)
      return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
    }

    const validWebRoles = ['SUPER_ADMIN', 'MANAGER', 'FINANCE', 'USER_MANAGEMENT', 'SUPPORT', 'TECHNICAL']

    if (!validWebRoles.includes(session.role)) {
      response = NextResponse.redirect(new URL('/admin/login?error=unauthorized', request.url))
      return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
    }

    response = NextResponse.next()
    response.headers.set('X-Admin-Id', session.id)
    response.headers.set('X-Admin-Role', session.role)

    if (pathname.startsWith('/admin/api/') || pathname.startsWith('/api/')) {
      response.headers.set('Cache-Control', 'no-store, must-revalidate')
    }

    return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
  }

  if (pathname === '/api/auth/forgot-password' || pathname === '/api/auth/reset-password') {
    response = NextResponse.next()
    return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
  }

  if (pathname === '/api/health') {
    response = NextResponse.next()
    applySecurityHeaders(response)
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response
  }

  if (pathname === '/api/waitlist') {
    response = NextResponse.next()
    return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
  }

  if (pathname.startsWith('/api/bookings') && !pathname.includes('admin')) {
    response = NextResponse.next()
    return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
  }

  if (pathname.startsWith('/api/vacancies')) {
    response = NextResponse.next()
    return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
  }

  if (pathname.startsWith('/api/mobile/')) {
    if (rateLimit.limited) {
      return new NextResponse(
        JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000).toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.floor(rateLimit.resetAt.getTime() / 1000).toString(),
          },
        }
      )
    }
    response = NextResponse.next()
    applySecurityHeaders(response)
    applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt)
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
    return response
  }

  if (
    pathname.startsWith('/api/') &&
    pathname !== '/api/admin/auth/login' &&
    pathname !== '/api/admin/auth/logout' &&
    pathname !== '/api/health' &&
    pathname !== '/api/waitlist' &&
    pathname !== '/api/auth/forgot-password' &&
    pathname !== '/api/auth/reset-password' &&
    !pathname.startsWith('/api/admin/') &&
    !pathname.startsWith('/api/internal/') &&
    pathname !== '/api/seed/auto' &&
    pathname !== '/api/seed/test-data' &&
    pathname !== '/api/seed/real-estate' &&
    pathname !== '/api/real-estate' &&
    !pathname.startsWith('/api/real-estate/') &&
    pathname !== '/api/properties' &&
    !pathname.startsWith('/api/properties/') &&
    !pathname.startsWith('/api/services') &&
    !pathname.startsWith('/api/categories') &&
    !pathname.startsWith('/api/industries') &&
    !pathname.startsWith('/api/testimonials') &&
    !pathname.startsWith('/api/booking') &&
    !pathname.startsWith('/api/cron/')
  ) {
    const session = await getSession(request)
    if (!session) {
      response = NextResponse.json(
        { error: 'Unauthorized', code: 'NO_SESSION' },
        { status: 401 }
      )
      return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
    }
    response = NextResponse.next()
    response.headers.set('X-User-Id', session.id)
    response.headers.set('X-User-Role', session.role)
    return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
  }

  if (pathname === '/maintenance' || pathname.startsWith('/api/settings/maintenance')) {
    response = NextResponse.next()
    return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
  }

  response = NextResponse.next()
  return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
}

export const config = {
  matcher: [
    '/api/:path*',
    '/admin/:path*',
  ],
}
