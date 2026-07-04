import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import type { AdminRole } from './admin-types'

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production'
}

function getJwtRefreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET || 'dev-jwt-refresh-secret-change-in-production'
}

export interface AccessTokenPayload {
  sub: string
  email: string
  role: AdminRole
  firstName: string
  lastName: string
  assignedCountries: string[]
  type: 'access'
}

export interface RefreshTokenPayload {
  sub: string
  jti: string
  type: 'refresh'
}

export function signAccessToken(user: {
  id: string
  email: string
  role: AdminRole
  firstName: string
  lastName: string
  assignedCountries: string[]
}): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      assignedCountries: user.assignedCountries,
      type: 'access',
    } satisfies AccessTokenPayload,
    getJwtSecret(),
    { expiresIn: '15m' }
  )
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as AccessTokenPayload
    if (payload.type !== 'access') return null
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
