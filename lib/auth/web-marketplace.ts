import { NextRequest, NextResponse } from 'next/server'

export const WEB_MARKETPLACE_ACCESS_COOKIE = 'mx_marketplace_access'
export const WEB_MARKETPLACE_REFRESH_COOKIE = 'mx_marketplace_refresh'

function secureCookie() {
  return process.env.NODE_ENV === 'production'
}

export function applyMarketplaceWebAuthCookies(
  response: NextResponse,
  input: {
    accessToken: string
    refreshToken: string
    sessionExpiresAt?: string | null
    accessExpiresIn?: number | null
  }
): NextResponse {
  const accessMaxAge =
    Number.isFinite(Number(input.accessExpiresIn)) && Number(input.accessExpiresIn) > 0
      ? Math.min(Number(input.accessExpiresIn), 60 * 60)
      : 15 * 60

  let refreshMaxAge = 7 * 24 * 60 * 60
  if (input.sessionExpiresAt) {
    const expiresAt = new Date(input.sessionExpiresAt).getTime()
    if (Number.isFinite(expiresAt)) {
      refreshMaxAge = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000))
    }
  }

  response.cookies.set(WEB_MARKETPLACE_ACCESS_COOKIE, input.accessToken, {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: accessMaxAge,
  })

  response.cookies.set(WEB_MARKETPLACE_REFRESH_COOKIE, input.refreshToken, {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: 'strict',
    path: '/',
    maxAge: refreshMaxAge,
  })

  return response
}

export function clearMarketplaceWebAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set(WEB_MARKETPLACE_ACCESS_COOKIE, '', {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  response.cookies.set(WEB_MARKETPLACE_REFRESH_COOKIE, '', {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
  return response
}

export function getMarketplaceWebAccessToken(request: NextRequest): string | null {
  return request.cookies.get(WEB_MARKETPLACE_ACCESS_COOKIE)?.value || null
}

export function getMarketplaceWebRefreshToken(request: NextRequest): string | null {
  return request.cookies.get(WEB_MARKETPLACE_REFRESH_COOKIE)?.value || null
}

export async function cloneRequestWithMarketplaceBearer(
  request: NextRequest,
  options?: { includeBody?: boolean }
): Promise<NextRequest | null> {
  const token = getMarketplaceWebAccessToken(request)
  if (!token) return null

  const headers = new Headers(request.headers)
  headers.set('authorization', `Bearer ${token}`)
  headers.delete('cookie')

  const init: RequestInit = {
    method: request.method,
    headers,
  }

  if (options?.includeBody && !['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    init.body = await request.text()
  }

  return new NextRequest(request.url, init)
}

export function safeMarketplaceAuthPayload(payload: any) {
  if (!payload || typeof payload !== 'object') return payload
  const {
    accessToken: _accessToken,
    refreshToken: _refreshToken,
    token: _token,
    ...safe
  } = payload
  return safe
}
