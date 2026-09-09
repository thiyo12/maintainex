import jwt from 'jsonwebtoken'
import { TOKEN_PURPOSE, TOKEN_AUDIENCE, TOKEN_ISSUER, TOKEN_LIFETIMES } from './constants'

function getMarketplaceJwtSecret(): string {
  const secret = process.env.MARKETPLACE_JWT_SECRET
  if (!secret) throw new Error('[SECURITY] MARKETPLACE_JWT_SECRET environment variable is required')
  return secret
}

function parseTTL(ttl: string): number {
  const match = ttl.match(/^(\d+)([smhd])$/)
  if (!match) throw new Error(`Invalid TTL format: ${ttl}`)
  const value = parseInt(match[1], 10)
  const unit = match[2]
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }
  return value * multipliers[unit]
}

export interface MarketplaceAccessTokenClaims {
  sub: string
  sid: string
  aud: string
  iss: string
  jti: string
  type: string
  iat: number
  exp: number
}

export function signMarketplaceAccessToken(userId: string, sessionId: string): string {
  const secret = getMarketplaceJwtSecret()
  const ttlSeconds = parseTTL(TOKEN_LIFETIMES.MARKETPLACE_ACCESS)

  return jwt.sign(
    {
      sub: userId,
      sid: sessionId,
      aud: TOKEN_AUDIENCE.MARKETPLACE,
      iss: TOKEN_ISSUER,
      jti: crypto.randomUUID(),
      type: TOKEN_PURPOSE.MARKETPLACE_ACCESS,
    },
    secret,
    { expiresIn: ttlSeconds }
  )
}

export function verifyMarketplaceAccessToken(token: string): MarketplaceAccessTokenClaims | null {
  try {
    const secret = getMarketplaceJwtSecret()
    const payload = jwt.verify(token, secret, {
      audience: TOKEN_AUDIENCE.MARKETPLACE,
      issuer: TOKEN_ISSUER,
    }) as MarketplaceAccessTokenClaims

    if (payload.type !== TOKEN_PURPOSE.MARKETPLACE_ACCESS) return null
    if (!payload.sub || !payload.sid) return null

    return payload
  } catch {
    return null
  }
}
