import jwt from 'jsonwebtoken'

function getStaffJwtSecret(): string {
  const secret = process.env.STAFF_JWT_SECRET
  if (!secret) throw new Error('[SECURITY] STAFF_JWT_SECRET environment variable is required')
  return secret
}

export interface StaffAccessTokenClaims {
  sub: string
  sid: string
  aud: string
  iss: string
  jti: string
  type: string
  iat: number
  exp: number
}

const STAFF_AUDIENCE = 'maintainex-staff'
const STAFF_ISSUER = 'maintainex'
const STAFF_TOKEN_TYPE = 'staff_access'
const STAFF_ACCESS_TTL_SECONDS = 30 * 60

export function signStaffAccessToken(adminUserId: string, sessionId: string): string {
  const jti = crypto.randomUUID()
  return jwt.sign(
    {
      sub: adminUserId,
      sid: sessionId,
      aud: STAFF_AUDIENCE,
      iss: STAFF_ISSUER,
      jti,
      type: STAFF_TOKEN_TYPE,
    },
    getStaffJwtSecret(),
    { expiresIn: STAFF_ACCESS_TTL_SECONDS }
  )
}

export function verifyStaffAccessToken(token: string): StaffAccessTokenClaims | null {
  try {
    const payload = jwt.verify(token, getStaffJwtSecret(), {
      audience: STAFF_AUDIENCE,
      issuer: STAFF_ISSUER,
    }) as StaffAccessTokenClaims
    if (payload.type !== STAFF_TOKEN_TYPE) return null
    if (!payload.sub || !payload.sid) return null
    return payload
  } catch {
    return null
  }
}

export function isStaffTokenClaims(claims: any): claims is StaffAccessTokenClaims {
  return claims?.type === STAFF_TOKEN_TYPE && claims?.aud === STAFF_AUDIENCE && claims?.iss === STAFF_ISSUER
}
