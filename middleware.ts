import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const securityHeaders = {
  'X-DNS-Prefetch-Control': 'on',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/admin') ||
    pathname === '/maintenance' ||
    pathname.startsWith('/api/')
  ) {
    const response = NextResponse.next()
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    return response
  }

  try {
    const baseUrl = request.url.split('/')[0] + '//' + request.url.split('/')[2]
    const apiUrl = `${baseUrl}/api/settings/maintenance?_=${Date.now()}`
    
    const response = await fetch(apiUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      
      if (data.maintenanceMode === true) {
        const maintenanceUrl = new URL('/maintenance', request.url)
        return NextResponse.redirect(maintenanceUrl)
      }
    }
  } catch (error) {
    console.error('Maintenance check failed:', error)
  }

  const response = NextResponse.next()
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)',
  ],
}
