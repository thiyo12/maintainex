import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { verifyStaffAccessToken } from '@/lib/auth/staff-jwt'
import { getActiveStaffSession } from '@/lib/auth/staff-sessions'
import { verifySimpleToken } from './admin-auth'

export interface SessionUser {
  id: string
  email: string
  role: string
  branchId?: string | null
  province?: string | null
  region?: string | null
  name?: string | null
  canEditServices?: boolean
  authType?: 'MARKETPLACE' | 'STAFF' | 'LEGACY'
}

async function resolveLiveStaffSession(token: string): Promise<SessionUser | null> {
  const claims = verifyStaffAccessToken(token)
  if (!claims) return null

  const session = await getActiveStaffSession(claims.sid)
  if (!session || session.adminUserId !== claims.sub) return null

  const admin = await prisma.adminUser.findUnique({
    where: { id: claims.sub },
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

  if (
    !admin ||
    !admin.isActive ||
    admin.deletedAt ||
    (admin.lockedUntil && admin.lockedUntil > new Date()) ||
    (admin.role === 'SUPER_ADMIN' && (!admin.totpEnabled || !admin.totpSecret))
  ) {
    return null
  }

  return {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    name: [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.email,
    authType: 'STAFF',
  }
}

function normalizeLegacySession(payload: any): SessionUser | null {
  if (!payload || !payload.id || !payload.email || !payload.role) return null
  return {
    id: payload.id,
    email: payload.email,
    role: payload.role,
    branchId: payload.branchId || null,
    province: payload.province || null,
    region: payload.region || null,
    name: payload.name || null,
    canEditServices: payload.canEditServices || false,
    authType: 'LEGACY',
  }
}

/**
 * Compatibility resolver for older routes.
 *
 * Production accepts only the canonical marketplace/staff token families and
 * validates their live session/account state. Legacy JWT_SECRET tokens remain
 * available only in non-production so older local tooling can be retired
 * incrementally without reopening a production auth boundary.
 */
export async function getSession(request: NextRequest): Promise<SessionUser | null> {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const marketplace = await authenticateMarketplaceUser(request)
    if (marketplace) {
      return {
        id: marketplace.id,
        email: marketplace.email,
        role: marketplace.role,
        name: marketplace.name,
        authType: 'MARKETPLACE',
      }
    }

    const token = authHeader.slice(7)
    const staff = await resolveLiveStaffSession(token)
    if (staff) return staff

    if (process.env.NODE_ENV !== 'production') {
      return normalizeLegacySession(verifySimpleToken(token))
    }
    return null
  }

  const cookieToken = request.cookies.get('admin_token')?.value
  if (!cookieToken) return null

  const staff = await resolveLiveStaffSession(cookieToken)
  if (staff) return staff

  if (process.env.NODE_ENV !== 'production') {
    return normalizeLegacySession(verifySimpleToken(cookieToken))
  }

  return null
}
