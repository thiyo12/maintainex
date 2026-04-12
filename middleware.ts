import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/admin') ||
    pathname === '/maintenance' ||
    pathname.startsWith('/api/')
  ) {
    return NextResponse.next()
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

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)',
  ],
}
