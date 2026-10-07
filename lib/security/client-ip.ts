export type TrustedProxyMode = 'cloudflare' | 'reverse-proxy'

type HeaderReader = {
  get(name: string): string | null
}

function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 64) return null
  // IPv4, IPv6 and IPv4-mapped IPv6 only. Never let arbitrary header text
  // become a trusted rate-limit/audit identity.
  if (!/^[0-9a-fA-F:.]+$/.test(trimmed)) return null
  return trimmed
}

function firstForwardedIp(value: string | null): string | null {
  if (!value) return null
  return normalizeIp(value.split(',')[0])
}

export function getTrustedClientIp(
  headers: HeaderReader,
  options: {
    production?: boolean
    proxyMode?: string | null
  } = {},
): string {
  const production = options.production ?? process.env.NODE_ENV === 'production'
  const proxyMode = (options.proxyMode ?? process.env.TRUSTED_PROXY_MODE ?? '')
    .trim()
    .toLowerCase()

  if (production) {
    if (proxyMode === 'cloudflare') {
      return normalizeIp(headers.get('cf-connecting-ip')) || 'unknown'
    }
    if (proxyMode === 'reverse-proxy') {
      return normalizeIp(headers.get('x-real-ip')) || 'unknown'
    }

    // Fail closed when production proxy trust is not explicitly configured.
    // Startup validation rejects this configuration before serving traffic.
    return 'unknown'
  }

  return (
    normalizeIp(headers.get('cf-connecting-ip')) ||
    firstForwardedIp(headers.get('x-forwarded-for')) ||
    normalizeIp(headers.get('x-real-ip')) ||
    'unknown'
  )
}
