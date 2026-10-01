import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import type { AdminRole } from '../../admin-types'

function getJwtSecret(): string {
  if (!process.env.JWT_SECRET && !process.env.NEXTAUTH_SECRET) throw new Error('[SECURITY] JWT_SECRET or NEXTAUTH_SECRET env var is required')
  return process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET!
}

function getJwtRefreshSecret(): string {
  if (!process.env.JWT_REFRESH_SECRET) throw new Error('[SECURITY] JWT_REFRESH_SECRET env var is required')
  return process.env.JWT_REFRESH_SECRET
}

export interface AccessTokenPayload {
  sub: string
  email: string
  role: AdminRole
  firstName: string
  lastName: string
  assignedCountries: string[]
  sid: string
  type: 'access'
}

export interface RefreshTokenPayload {
  sub: string
  jti: string
  nonce: string
  type: 'refresh'
}

export function signAccessToken(user: {
  id: string
  email: string
  role: AdminRole
  firstName: string
  lastName: string
  assignedCountries: string[]
  sessionId: string
}): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      assignedCountries: user.assignedCountries,
      sid: user.sessionId,
      type: 'access',
    } satisfies AccessTokenPayload,
    getJwtSecret(),
    { expiresIn: '24h' }
  )
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as AccessTokenPayload
    if (payload.type !== 'access') return null
    if (typeof payload.sid !== 'string' || !payload.sid) return null
    return payload
  } catch {
    return null
  }
}

export function signRefreshToken(adminUserId: string, jti: string): string {
  return jwt.sign(
    {
      sub: adminUserId,
      jti,
      nonce: crypto.randomBytes(16).toString('hex'),
      type: 'refresh',
    } satisfies RefreshTokenPayload,
    getJwtRefreshSecret(),
    { expiresIn: '7d' }
  )
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const payload = jwt.verify(token, getJwtRefreshSecret()) as RefreshTokenPayload
    if (payload.type !== 'refresh') return null
    if (typeof payload.jti !== 'string' || !payload.jti) return null
    if (typeof payload.nonce !== 'string' || !payload.nonce) return null
    return payload
  } catch {
    return null
  }
}

export function generateRefreshTokenValue(): string {
  return crypto.randomBytes(64).toString('hex')
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function matchesRefreshTokenHash(token: string, expectedHash: string): boolean {
  const actualHash = hashRefreshToken(token)
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false
  try {
    return crypto.timingSafeEqual(
      Buffer.from(actualHash, 'hex'),
      Buffer.from(expectedHash, 'hex'),
    )
  } catch {
    return false
  }
}
