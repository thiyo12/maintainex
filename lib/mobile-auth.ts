import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from './prisma'

const TOKEN_MAX_AGE = '30d'

function getJwtSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET environment variable is required')
  }
  return secret
}

export function createToken(data: object): string | null {
  try {
    const secret = getJwtSecret()
    return jwt.sign(data, secret, { expiresIn: TOKEN_MAX_AGE })
  } catch {
    return null
  }
}

export function verifyToken(token: string): any {
  try {
    const secret = getJwtSecret()
    return jwt.verify(token, secret)
  } catch {
    return null
  }
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return null
}

export type AuthenticatedUser = {
  id: string
  email: string
  name: string
  phone: string | null
  role: string
  isActive: boolean
  identityStatus: string | null
  lastNameChangedAt: Date | null
  isSuspended: boolean
  isBanned: boolean
  suspendedUntil: Date | null
  suspensionReason: string | null
  banReason: string | null
}

export function assertNotSuspended(user: AuthenticatedUser): NextResponse | null {
  if (user.isBanned) {
    return NextResponse.json({
      error: 'Account banned',
      code: 'BANNED',
      reason: user.banReason || 'Your account has been permanently banned for violating platform terms.',
    }, { status: 403 })
  }

  if (user.isSuspended) {
    if (!user.suspendedUntil) {
      return NextResponse.json({
        error: 'Account suspended',
        code: 'SUSPENDED',
        reason: user.suspensionReason || 'Your account has been suspended.',
      }, { status: 403 })
    }

    if (new Date(user.suspendedUntil) > new Date()) {
      return NextResponse.json({
        error: 'Account temporarily suspended',
        code: 'SUSPENDED',
        reason: user.suspensionReason || 'Your account is temporarily suspended.',
        suspendedUntil: user.suspendedUntil.toISOString(),
      }, { status: 403 })
    }
  }

  return null
}

export async function authenticateRequest(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, name: true, phone: true, role: true, isActive: true, identityStatus: true, lastNameChangedAt: true, isSuspended: true, isBanned: true, suspendedUntil: true, suspensionReason: true, banReason: true },
  })

  if (!user || !user.isActive) return null
  return user
}
