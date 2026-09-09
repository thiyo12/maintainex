import { prisma } from '../prisma'
import { parseRefreshToken, generateRefreshToken, verifyRefreshSecret } from './refresh'
import { signMarketplaceAccessToken } from './marketplace-jwt'
import { revokeTokenFamily } from './sessions'
import { AuthError } from './errors'
import { TOKEN_LIFETIMES } from './constants'
import { recordSecurityEvent } from '../security/risk-score'

export interface RotateContext {
  ipAddress?: string
  userAgent?: string
}

export interface RotateResult {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
  sessionExpiresAt: Date
}

export async function rotateMarketplaceRefreshToken(
  rawRefreshToken: string,
  context?: RotateContext
): Promise<RotateResult> {
  const parsed = parseRefreshToken(rawRefreshToken)
  if (!parsed) throw new AuthError('INVALID_TOKEN')

  const { sessionId, secret } = parsed
  const session = await prisma.userSession.findUnique({ where: { id: sessionId } })
  if (!session) throw new AuthError('INVALID_TOKEN')

  if (session.revokedAt) {
    await recordReplay(session.userId, sessionId, context)
    throw new AuthError('TOKEN_REPLAY')
  }
  if (session.expiresAt < new Date()) throw new AuthError('SESSION_EXPIRED')

  if (!session.refreshTokenHash) {
    await revokeTokenFamily(session.tokenFamilyId ?? null, 'missing_refresh_hash')
    await recordReplay(session.userId, sessionId, context)
    throw new AuthError('TOKEN_REPLAY')
  }

  if (!verifyRefreshSecret(secret, session.refreshTokenHash)) {
    await revokeTokenFamily(session.tokenFamilyId ?? null, 'replay_detected')
    await recordReplay(session.userId, sessionId, context)
    throw new AuthError('TOKEN_REPLAY')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, isActive: true, isBanned: true, isSuspended: true, suspendedUntil: true },
  })
  if (!user || !user.isActive) throw new AuthError('ACCOUNT_DISABLED')
  if (user.isBanned) throw new AuthError('ACCOUNT_BANNED')
  if (user.isSuspended && (!user.suspendedUntil || user.suspendedUntil > new Date())) {
    throw new AuthError('ACCOUNT_SUSPENDED')
  }

  const newRefresh = generateRefreshToken(sessionId)

  // Prisma model UserSession is mapped to the historical physical table "Session".
  // Keep the compare-and-set in raw SQL for concurrency safety, but target the
  // mapped table name so rotation works in the real production schema.
  const rotated = await prisma.$executeRaw`
    UPDATE "Session"
    SET
      "refreshTokenHash" = ${newRefresh.secretHash},
      "lastUsedAt" = NOW(),
      "updatedAt" = NOW()
    WHERE
      "id" = ${sessionId}
      AND "refreshTokenHash" = ${session.refreshTokenHash}
      AND "revokedAt" IS NULL
      AND "expiresAt" > NOW()
  `

  if (rotated === 0) {
    await revokeTokenFamily(session.tokenFamilyId ?? null, 'replay_detected')
    await recordReplay(session.userId, sessionId, context)
    throw new AuthError('TOKEN_REPLAY')
  }

  const accessToken = signMarketplaceAccessToken(session.userId, sessionId)
  const ttlMs = parseTTLSeconds(TOKEN_LIFETIMES.MARKETPLACE_ACCESS) * 1000
  return {
    accessToken,
    refreshToken: newRefresh.raw,
    accessTokenExpiresAt: new Date(Date.now() + ttlMs),
    sessionExpiresAt: session.expiresAt,
  }
}

async function recordReplay(userId: string, sessionId: string, context?: RotateContext) {
  try {
    await recordSecurityEvent(
      'TOKEN_REPLAY',
      'AUTH',
      userId,
      'UserSession',
      sessionId,
      'HIGH',
      {
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        timestamp: new Date().toISOString(),
      }
    )
  } catch {}
}

function parseTTLSeconds(ttl: string): number {
  const match = ttl.match(/^(\d+)([smhd])$/)
  if (!match) throw new Error(`Invalid TTL format: ${ttl}`)
  const value = parseInt(match[1], 10)
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }
  return value * multipliers[match[2]]
}
