import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

const securityHeaders = {
  'X-DNS-Prefetch-Control': 'on',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.cloudinary.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://res.cloudinary.com https://*.cloudinary.com; connect-src 'self' https://api.cloudinary.com; frame-ancestors 'none'",
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

async function getSession(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7)
      const decoded = JSON.parse(atob(token))
      if (decoded.id && decoded.email && decoded.role) {
        return {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          branchId: decoded.branchId || null,
          province: decoded.province || null,
          name: decoded.name || null,
          canEditServices: decoded.canEditServices || false
        }
      }
    } catch {}
  }

  const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-key-change-in-production'
  
  function verifySimpleToken(token: string): any {
    try {
      const [encoded, signature] = token.split('.')
      if (!encoded || !signature) return null
      
      const expectedSig = Buffer.from(JWT_SECRET + encoded).toString('base64').slice(0, 32)
      if (signature !== expectedSig) return null
      
      const payload = JSON.parse(Buffer.from(encoded, 'base64').toString())
      
      const maxAge = 30 * 24 * 60 * 60 * 1000
      if (Date.now() - payload.created > maxAge) return null
      
      return payload
    } catch {
      return null
    }
  }

  const token = request.cookies.get('admin_token')?.value
  
  if (!token) return null
  
  const payload = verifySimpleToken(token)
  if (!payload) return null
  
  return {
    id: payload.id,
    email: payload.email,
    role: payload.role,
    branchId: payload.branchId,
    province: payload.province || null,
    name: payload.name,
    canEditServices: payload.canEditServices || false
  }
}

async function checkRateLimit(
  identifier: string,
  type: 'IP' | 'USER',
  limitType = 'default'
): Promise<{ remaining: number; resetAt: Date }> {
  const config = RATE_LIMITS[limitType as keyof typeof RATE_LIMITS] || RATE_LIMITS.default
  const windowStart = new Date(Date.now() - config.windowSeconds * 1000)
  
  try {
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
          windowStart: new Date(),
          windowEnd: new Date(Date.now() + config.windowSeconds * 1000),
          limited: false,
        },
      })
      
      return {
        remaining: config.maxRequests - 1,
        resetAt: new Date(Date.now() + config.windowSeconds * 1000),
      }
    }

    const newCount = existing.requestCount + 1
    const limited = newCount > config.maxRequests

    await prisma.rateLimitLog.update({
      where: { id: existing.id },
      data: { 
        requestCount: newCount,
        limited,
        blockUntil: limited ? new Date(Date.now() + config.windowSeconds * 1000) : null,
      },
    })

    return {
      remaining: Math.max(0, config.maxRequests - newCount),
      resetAt: existing.windowStart,
    }
  } catch {
    return {
      remaining: config.maxRequests,
      resetAt: new Date(Date.now() + config.windowSeconds * 1000),
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             'unknown'
  
  const rateLimitType = pathname.startsWith('/api/auth') ? 'auth' : 'admin'
  const rateLimit = await checkRateLimit(ip, 'IP', rateLimitType)
  
  let response: NextResponse

  if (pathname.startsWith('/coconut/login') || pathname.startsWith('/coconut/api/auth')) {
    response = NextResponse.next()
    return applySecurityHeaders(
      applyCoconutHeaders(response, rateLimit.remaining, rateLimit.resetAt)
    )
  }

  if (pathname.startsWith('/coconut') && !pathname.startsWith('/coconut/login')) {
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
      
      const loginUrl = new URL('/coconut/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      
      response = NextResponse.redirect(loginUrl)
      return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
    }

    if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
      await logAccessAttempt(
        'ACCESS_DENIED',
        'AUTH',
        request,
        session,
        false,
        'Invalid role',
        'HIGH'
      )
      
      response = NextResponse.redirect(new URL('/coconut/login?error=unauthorized', request.url))
      return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt))
    }

    response = NextResponse.next()
    response.headers.set('X-Admin-Id', session.id)
    response.headers.set('X-Admin-Role', session.role)
    
    if (pathname.startsWith('/coconut/api/') || pathname.startsWith('/api/')) {
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
    pathname.startsWith('/api/') &&
    pathname !== '/api/auth/login' &&
    pathname !== '/api/auth/logout'
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
    '/((?!_next/static|_next/image|favicon.ico|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)',
  ],
}
