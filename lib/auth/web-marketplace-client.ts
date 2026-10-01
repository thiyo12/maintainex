export async function marketplaceWebFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const request = () =>
    fetch(input, {
      ...init,
      credentials: 'include',
      cache: init.cache ?? 'no-store',
    })

  let response = await request()
  if (response.status !== 401) return response

  const target = typeof input === 'string' ? input : input instanceof URL ? input.pathname : ''
  if (
    target.includes('/api/web/auth/otp-login') ||
    target.includes('/api/web/auth/register') ||
    target.includes('/api/web/auth/verify-registration') ||
    target.includes('/api/web/auth/refresh') ||
    target.includes('/api/web/auth/logout')
  ) {
    return response
  }

  const refresh = await fetch('/api/web/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'X-MaintainEX-Web-Refresh': '1' },
  })

  if (!refresh.ok) return response

  response = await request()
  return response
}
