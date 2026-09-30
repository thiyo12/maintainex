import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyMarketplaceAccessToken } from '@/lib/auth/marketplace-jwt'
import { AuthenticatedUser, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'

export { assertNotSuspended }

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
  countryCode: true,
} as const

export async function authenticateMarketplaceUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const auth = request.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null

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

