import { prisma } from '../prisma'
import { createSession } from './sessions'
import { signMarketplaceAccessToken } from './marketplace-jwt'

export interface AuthSessionContext {
  ipAddress?: string
  userAgent?: string
}

export interface AuthSessionResult {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
  sessionExpiresAt: Date
  user: {
    id: string
    email: string
    name: string
    phone: string | null
    role: string
    isActive: boolean
    createdAt: Date
  }
}

export async function createMarketplaceAuthSession(
  userId: string,
  context?: AuthSessionContext
): Promise<AuthSessionResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  })

  if (!user) throw new Error('User not found')
  if (!user.isActive) throw new Error('Account disabled')

  const session = await createSession({
    userId: user.id,
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  })

  const accessToken = signMarketplaceAccessToken(user.id, session.sessionId)

  return {
    accessToken,
    refreshToken: session.refreshTokenRaw,
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    sessionExpiresAt: session.expiresAt,
    user,
  }
}

export function buildAuthResponse(result: AuthSessionResult) {
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    accessExpiresIn: 900,
    sessionExpiresAt: result.sessionExpiresAt.toISOString(),
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      phone: result.user.phone,
      role: result.user.role,
      isActive: result.user.isActive,
      createdAt: result.user.createdAt.toISOString(),
    },
  }
}
