import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'
import { verifyMarketplaceAccessToken } from './auth/marketplace-jwt'

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

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  isActive: true,
  identityStatus: true,
  lastNameChangedAt: true,
  isSuspended: true,
  isBanned: true,
  suspendedUntil: true,
  suspensionReason: true,
  banReason: true,
} as const

async function tryCanonicalAuth(token: string): Promise<AuthenticatedUser | null> {
  const claims = verifyMarketplaceAccessToken(token)
  if (!claims) return null

  const session = await prisma.userSession.findUnique({
    where: { id: claims.sid },
  })
  if (!session) return null
  if (session.userId !== claims.sub) return null
  if (!session.isValid) return null
  if (session.revokedAt) return null
  if (session.expiresAt < new Date()) return null

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: USER_SELECT,
  })
  if (!user || !user.isActive) return null

  return user
}

export async function authenticateRequest(request: NextRequest): Promise<AuthenticatedUser | null> {
  const token = getTokenFromRequest(request)
  if (!token) return null

  const canonical = await tryCanonicalAuth(token)
  if (canonical) return canonical

  return null
}
