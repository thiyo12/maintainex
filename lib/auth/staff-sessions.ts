import crypto from 'crypto'
import { prisma } from '../prisma'
import { signStaffAccessToken, type StaffAccessTokenClaims } from './staff-jwt'
import { generateStaffRefreshToken } from './staff-rotation'

const SESSION_TTL_DAYS = 7

export interface CreateStaffSessionParams {
  adminUserId: string
  ipAddress?: string
  userAgent?: string
}

export interface CreateStaffSessionResult {
  accessToken: string
  refreshTokenRaw: string
  sessionExpiresAt: Date
  user: {
    id: string
    email: string
    role: string
    firstName: string
    lastName: string
  }
}

export async function createStaffSession(
  params: CreateStaffSessionParams
): Promise<CreateStaffSessionResult> {
  const adminUser = await prisma.adminUser.findUnique({
    where: { id: params.adminUserId },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      isActive: true,
      deletedAt: true,
      lockedUntil: true,
      totpEnabled: true,
      totpSecret: true,
    },
  })

  if (!adminUser) throw new Error('AdminUser not found')
  if (
    !adminUser.isActive ||
    adminUser.deletedAt ||
    (adminUser.lockedUntil && adminUser.lockedUntil > new Date())
  ) {
    throw new Error('Account disabled')
  }
  if (
    adminUser.role === 'SUPER_ADMIN' &&
    (!adminUser.totpEnabled || !adminUser.totpSecret)
  ) {
    throw new Error('SUPER_ADMIN_MFA_REQUIRED')
  }

  const tokenFamilyId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

  const placeholderSession = await prisma.adminSession.create({
    data: {
      adminUserId: adminUser.id,
      refreshTokenHash: 'pending',
      tokenFamilyId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      expiresAt,
    },
  })

  const { raw, secretHash } = generateStaffRefreshToken()

  await prisma.adminSession.update({
    where: { id: placeholderSession.id },
    data: { refreshTokenHash: secretHash },
  })

  const accessToken = signStaffAccessToken(adminUser.id, placeholderSession.id)

  return {
    accessToken,
    refreshTokenRaw: `${placeholderSession.id}.${raw}`,
    sessionExpiresAt: expiresAt,
    user: {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
    },
  }
}

export async function revokeStaffSession(sessionId: string): Promise<void> {
  await prisma.adminSession.updateMany({
    where: { id: sessionId, isRevoked: false },
    data: { isRevoked: true, revokedAt: new Date() },
  })
}

export async function revokeAllStaffSessions(
  adminUserId: string,
  reason?: string
): Promise<void> {
  await prisma.adminSession.updateMany({
    where: { adminUserId, isRevoked: false },
    data: { isRevoked: true, revokedAt: new Date() },
  })
}


export async function getActiveStaffSession(
  sessionId: string
): Promise<{ id: string; adminUserId: string; expiresAt: Date } | null> {
  const session = await prisma.adminSession.findUnique({
    where: { id: sessionId },
    select: { id: true, adminUserId: true, expiresAt: true, isRevoked: true },
  })
  if (!session) return null
  if (session.isRevoked) return null
  if (session.expiresAt < new Date()) return null
  return session
}

export interface StaffPrincipal {
  principalType: 'STAFF'
  adminUserId: string
  sessionId: string
}

export async function authenticateStaffRequest(
  request: { headers: { get: (name: string) => string | null } }
): Promise<StaffPrincipal | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)
  const claims = (await import('./staff-jwt')).verifyStaffAccessToken(token)
  if (!claims) return null

  const session = await getActiveStaffSession(claims.sid)
  if (!session) return null
  if (session.adminUserId !== claims.sub) return null

  const adminUser = await prisma.adminUser.findUnique({
    where: { id: claims.sub },
    select: { id: true, isActive: true, deletedAt: true },
  })
  if (!adminUser || !adminUser.isActive || adminUser.deletedAt) return null

  return {
    principalType: 'STAFF',
    adminUserId: claims.sub,
    sessionId: claims.sid,
  }
}
