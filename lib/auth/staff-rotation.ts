import crypto from 'crypto'
import { prisma } from '../prisma'
import { signStaffAccessToken } from './staff-jwt'

const REFRESH_TOKEN_BYTES = 64
const SESSION_TTL_DAYS = 7

export function generateStaffRefreshToken(): { raw: string; secretHash: string } {
  const secret = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex')
  const secretHash = crypto.createHash('sha256').update(secret).digest('hex')
  return { raw: secret, secretHash }
}

export function parseStaffRefreshToken(token: string): { sessionId: string; secret: string } | null {
  const dotIndex = token.indexOf('.')
  if (dotIndex < 1) return null
  const sessionId = token.slice(0, dotIndex)
  const secret = token.slice(dotIndex + 1)
  if (!sessionId || !secret) return null
  if (secret.length < 32) return null
  return { sessionId, secret }
}

export function verifyStaffRefreshSecret(secret: string, hash: string): boolean {
  const computed = crypto.createHash('sha256').update(secret).digest('hex')
  if (computed.length !== hash.length) return false
  let result = 0
  for (let i = 0; i < computed.length; i++) {
    result |= computed.charCodeAt(i) ^ hash.charCodeAt(i)
  }
  return result === 0
}

export interface StaffRotationResult {
  accessToken: string
  refreshTokenRaw: string
  sessionExpiresAt: Date
}

export async function rotateStaffRefreshToken(
  refreshTokenRaw: string,
  context?: { ipAddress?: string; userAgent?: string }
): Promise<StaffRotationResult | null> {
  const parsed = parseStaffRefreshToken(refreshTokenRaw)
  if (!parsed) return null

  const session = await prisma.adminSession.findUnique({
    where: { id: parsed.sessionId },
  })
  if (!session) return null
  if (session.isRevoked) return null
  if (session.expiresAt < new Date()) return null

  const secretMatch = verifyStaffRefreshSecret(parsed.secret, session.refreshTokenHash)
  if (!secretMatch) {
    const familyId = session.tokenFamilyId || session.id
    await prisma.adminSession.updateMany({
      where: {
        adminUserId: session.adminUserId,
        tokenFamilyId: familyId,
        isRevoked: false,
      },
      data: { isRevoked: true, revokedAt: new Date() },
    })
    try {
      await prisma.securityAudit.create({
        data: {
          action: 'STAFF_TOKEN_REPLAY',
          category: 'AUTH',
          entityType: 'AdminSession',
          entityId: session.id,
          riskLevel: 'CRITICAL',
          ipAddress: context?.ipAddress || 'unknown',
          userAgent: context?.userAgent || 'unknown',
          details: JSON.stringify({ familyId, sessionId: session.id }),
        },
      })
    } catch {}
    return null
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { id: session.adminUserId },
  })
  if (!adminUser || !adminUser.isActive || adminUser.deletedAt) return null

  const newRefresh = generateStaffRefreshToken()
  const familyId = session.tokenFamilyId || session.id
  const newExpiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

  const updated = await prisma.adminSession.updateMany({
    where: {
      id: session.id,
      refreshTokenHash: session.refreshTokenHash,
      isRevoked: false,
    },
    data: {
      refreshTokenHash: newRefresh.secretHash,
      tokenFamilyId: familyId,
      lastUsedAt: new Date(),
      expiresAt: newExpiresAt,
    },
  })

  if (updated.count === 0) return null

  const accessToken = signStaffAccessToken(adminUser.id, session.id)

  return {
    accessToken,
    refreshTokenRaw: `${session.id}.${newRefresh.raw}`,
    sessionExpiresAt: newExpiresAt,
  }
}
