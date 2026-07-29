import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const JWT_SECRET = process.env.NEXTAUTH_SECRET
if (!JWT_SECRET) {
  throw new Error('NEXTAUTH_SECRET environment variable is required')
}

const securityHeaders = {
  'X-DNS-Prefetch-Control': 'on',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.cloudinary.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://res.cloudinary.com https://*.cloudinary.com; connect-src 'self' https://api.cloudinary.com; frame-ancestors 'none'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
}

const coconutSecurityHeaders = {
  ...securityHeaders,
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
}

const RATE_LIMITS = {
  default: { maxRequests: 100, windowSeconds: 60 },
  auth: { maxRequests: 5, windowSeconds: 60 },
  admin: { maxRequests: 200, windowSeconds: 60 },
}

async function verifySimpleToken(token: string): Promise<any> {
  try {
    const parts = token.split('.')
    
    // Standard JWT (3 parts: header.payload.signature)
    if (parts.length === 3) {
      const [headerB64, payloadB64, signatureB64] = parts
      const signingInput = `${headerB64}.${payloadB64}`
      
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(JWT_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      )
      const valid = await crypto.subtle.verify(
        'HMAC',
        key,
        Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0)),
        new TextEncoder().encode(signingInput)
      )
      if (!valid) return null

      const payload = JSON.parse(atob(payloadB64))
      // Check expiry if present
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

    // Legacy 2-part token
    const [encoded, signature] = parts
    if (!encoded || !signature) return null

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      Uint8Array.from(atob(signature), c => c.charCodeAt(0)),
      new TextEncoder().encode(encoded)
    )
    if (!valid) return null

    const payload = JSON.parse(atob(encoded))
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

async function checkRateLimit(
  identifier: string,
  type: 'IP' | 'USER',
  limitType = 'default'
): Promise<{ remaining: number; resetAt: Date; limited?: boolean }> {
  const config = RATE_LIMITS[limitType as keyof typeof RATE_LIMITS] || RATE_LIMITS.default
  const now = new Date()
  const windowStart = new Date(now.getTime() - config.windowSeconds * 1000)

  try {
    const { prisma } = await import('@/lib/prisma')
    const existing = await prisma.rateLimitLog.findFirst({
      where: {
        identifier,
        type,
        windowStart: { gte: windowStart },
      },
      orderBy: { windowStart: 'desc' },
    })

    if (!existing || existing.windowStart < windowStart) {
      await prisma.rateLimitLog.create({
        data: {
          identifier,
          type,
          endpoint: 'middleware',
          method: 'ALL',
          requestCount: 1,
          windowStart: now,
          windowEnd: new Date(now.getTime() + config.windowSeconds * 1000),
          limited: false,
        },
      })
      
      return {
        remaining: config.maxRequests - 1,
        resetAt: new Date(now.getTime() + config.windowSeconds * 1000),
      }
    }

    const newCount = existing.requestCount + 1
    const limited = newCount > config.maxRequests

    await prisma.rateLimitLog.update({
      where: { id: existing.id },
      data: { 
        requestCount: newCount,
        limited,
        blockUntil: limited ? new Date(now.getTime() + config.windowSeconds * 1000) : null,
      },
    })

    return {
      remaining: Math.max(0, config.maxRequests - newCount),
      resetAt: existing.windowStart,
    }
  } catch {
    return {
      remaining: 0,
      resetAt: new Date(Date.now() + 5000),
      limited: true,
    }
  }
}

async function logAccessAttempt(
  action: string,
  category: string,
  request: NextRequest,
  session: any,
  success: boolean,
  errorMessage?: string,
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
) {
  try {
    const { prisma } = await import('@/lib/prisma')
    await prisma.securityAudit.create({
      data: {
        action,
        category,
        userId: session?.id || null,
        userEmail: session?.email || null,
        userRole: session?.role || null,
        description: errorMessage || `${action} ${category}`,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
        success,
        errorMessage,
        riskLevel,
        isSuspicious: riskLevel === 'HIGH' || riskLevel === 'CRITICAL',
      },
    })
  } catch (error) {
    console.error('Failed to log access attempt:', error)
  }
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
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  Object.entries(coconutSecurityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  response.headers.set('X-RateLimit-Remaining', remaining.toString())
  response.headers.set('X-RateLimit-Reset', Math.floor(resetAt.getTime() / 1000).toString())
  return response
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow AI crawlers to index content with standard security headers
  if (isAiCrawler(request)) {
    const response = NextResponse.next()
    response.headers.set('X-Robots-Tag', 'all')
    response.headers.set('Cache-Control', 'public, max-age=3600')
    return applySecurityHeaders(response)
  }
  
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             'unknown'
  
  const isLoginRoute = pathname.startsWith('/api/auth') || pathname.startsWith('/api/admin/auth')
  const rateLimitType = isLoginRoute ? 'auth' : 'admin'
  const rateLimit = await checkRateLimit(ip, 'IP', rateLimitType)
  
  let response: NextResponse

  if (pathname.startsWith('/admin/login') || pathname.startsWith('/admin/api/auth')) {
    response = NextResponse.next()
    return applySecurityHeaders(
      applyCoconutHeaders(response, rateLimit.remaining, rateLimit.resetAt)
    )
  }

  // Block seed APIs in production
  if (pathname.startsWith('/api/seed/')) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse(
        JSON.stringify({ error: 'Not available in production' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }
    response = NextResponse.next()
    return applySecurityHeaders(
      applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt)
    )
  }

  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const session = await getSession(request)
    
    if (!session) {
      await logAccessAttempt(
        'ACCESS_DENIED',
        'AUTH',
        request,
        null,
        false,
        'No session - redirect to login',
        'MEDIUM'
      )
      
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      
      response = NextResponse.redirect(loginUrl)
      return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
    }

    const isMarketplaceRoute = pathname.startsWith('/admin/marketplace/')
    const isWebAdmin = session.authType === 'admin'
    const validWebRoles = ['SUPER_ADMIN', 'ADMIN']
    const validMarketplaceRoles = ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT']

    if (isMarketplaceRoute) {
      if (!validMarketplaceRoles.includes(session.role)) {
        await logAccessAttempt('ACCESS_DENIED', 'AUTH', request, session, false, 'Invalid marketplace role', 'HIGH')
        response = NextResponse.redirect(new URL('/admin/login?error=unauthorized', request.url))
        return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
      }
    } else if (!validWebRoles.includes(session.role)) {
      await logAccessAttempt('ACCESS_DENIED', 'AUTH', request, session, false, 'Invalid role', 'HIGH')
      response = NextResponse.redirect(new URL('/admin/login?error=unauthorized', request.url))
      return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
    }

    response = NextResponse.next()
    response.headers.set('X-Admin-Id', session.id)
    response.headers.set('X-Admin-Role', session.role)
    
    if (pathname.startsWith('/admin/api/') || pathname.startsWith('/api/')) {
      response.headers.set('Cache-Control', 'no-store, must-revalidate')
    }
    
    await logAccessAttempt(
      'ACCESS',
      'ADMIN',
      request,
      session,
      true,
      undefined,
      'LOW'
    )
    
    return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
  }

  if (
    pathname.startsWith('/api/bookings') &&
    !pathname.includes('admin')
  ) {
    response = NextResponse.next()
    return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
  }

  // Allow public access to vacancies API for careers page
  if (pathname.startsWith('/api/vacancies')) {
    response = NextResponse.next()
    return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
  }

  // Allow health check without auth
  if (pathname === '/api/health') {
    response = NextResponse.next()
    applySecurityHeaders(response)
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response
  }

  // Allow all mobile API paths (they handle auth via Bearer token)
  if (pathname.startsWith('/api/mobile/')) {
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
    pathname !== '/api/auth/login' &&
    pathname !== '/api/auth/logout' &&
    pathname !== '/api/health' &&
    !pathname.startsWith('/api/admin/') &&
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
      await logAccessAttempt(
        'API_ACCESS_DENIED',
        'AUTH',
        request,
        null,
        false,
        'API access without session',
        'MEDIUM'
      )
      
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

  try {
    const baseUrl = request.url.split('/')[0] + '//' + request.url.split('/')[2]
    const apiUrl = `${baseUrl}/api/settings/maintenance?_=${Date.now()}`
    
    const maintenanceResponse = await fetch(apiUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
    
    if (maintenanceResponse.ok) {
      const data = await maintenanceResponse.json()
      
      if (data.maintenanceMode === true) {
        const maintenanceUrl = new URL('/maintenance', request.url)
        response = NextResponse.redirect(maintenanceUrl)
        return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
      }
    }
  } catch (error) {
    console.error('Maintenance check failed:', error)
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
