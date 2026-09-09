import crypto from 'crypto'
import { prisma } from '../prisma'
import { generateRefreshToken } from './refresh'

const SESSION_TTL_DAYS = 30

export interface CreateSessionParams {
  userId: string
  ipAddress?: string
  userAgent?: string
}

export interface CreateSessionResult {
  sessionId: string
  refreshTokenRaw: string
  expiresAt: Date
}

export async function createSession(params: CreateSessionParams): Promise<CreateSessionResult> {
  const tokenFamilyId = crypto.randomUUID()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS)

  const placeholderSession = await prisma.userSession.create({
    data: {
      userId: params.userId,
      refreshTokenHash: 'pending',
      tokenFamilyId,
      ipAddress: params.ipAddress ?? 'unknown',
      userAgent: params.userAgent ?? 'unknown',
      expiresAt,
    },
  })

  const { raw, secretHash } = generateRefreshToken(placeholderSession.id)

  await prisma.userSession.update({
    where: { id: placeholderSession.id },
    data: { refreshTokenHash: secretHash },
  })

  return {
    sessionId: placeholderSession.id,
    refreshTokenRaw: raw,
    expiresAt,
  }
}

export async function getActiveSession(sessionId: string, userId: string) {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) return null
  if (session.userId !== userId) return null
  if (session.revokedAt) return null
  if (session.expiresAt < new Date()) return null

  return session
}

export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: {
      id: sessionId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokeReason: 'logout',
    },
  })
}

export async function revokeAllUserSessions(userId: string, reason = 'logout_all'): Promise<void> {
  await prisma.userSession.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokeReason: reason,
    },
  })
}

export async function revokeTokenFamily(tokenFamilyId: string | null, reason = 'replay_detected'): Promise<void> {
  if (!tokenFamilyId) return
  await prisma.userSession.updateMany({
    where: {
      tokenFamilyId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokeReason: reason,
    },
  })
}
