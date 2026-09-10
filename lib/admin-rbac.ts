import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'
import { verifyAccessToken } from './admin-jwt'
import { verifySimpleToken } from './admin-auth'
import type { AdminRole, AuditAction, AdminSession } from './admin-types'

export function getSessionFromCookie(request: NextRequest): AdminSession | null {
  const authHeader = request.headers.get('Authorization')
  let rawToken: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    rawToken = authHeader.slice(7)
  }

  if (!rawToken) {
    rawToken = request.cookies.get('admin_token')?.value || null
  }

  if (!rawToken) return null

  // Try new JWT access token first
  const jwtPayload = verifyAccessToken(rawToken)
  if (jwtPayload) {
    return {
      id: jwtPayload.sub,
      email: jwtPayload.email,
      role: jwtPayload.role,
      firstName: jwtPayload.firstName,
      lastName: jwtPayload.lastName,
      assignedCountries: jwtPayload.assignedCountries || [],
      authType: 'adminUser',
    }
  }

  // Fallback to old base64+HMAC custom token
  const payload = verifySimpleToken(rawToken)
  if (!payload) return null
  return {
    id: payload.id,
    email: payload.email,
    role: payload.role as AdminRole,
    firstName: payload.firstName || '',
    lastName: payload.lastName || '',
    assignedCountries: payload.assignedCountries || [],
    authType: 'adminUser',
  }
}

export function adminAuthorize(allowedRoles: AdminRole[]) {
  return (session: AdminSession | null): { authorized: boolean; error?: string; status?: number } => {
    if (!session) {
      return { authorized: false, error: 'Unauthorized', status: 401 }
    }
    if (!allowedRoles.includes(session.role)) {
      return { authorized: false, error: 'Forbidden', status: 403 }
    }
    return { authorized: true }
  }
}

export function getCountryFilter(session: AdminSession): Record<string, any> {
  if (session.role === 'SUPER_ADMIN') return {}
  if (session.assignedCountries.length === 0) return { id: '__NONE__' }
  return { countryCode: { in: session.assignedCountries } }
}

export async function createAuditLog(params: {
  session: AdminSession
  action: AuditAction
  targetTable?: string
  targetId?: string
  targetLabel?: string
  oldValue?: any
  newValue?: any
  ipAddress: string
  userAgent?: string | null
}) {
  try {
    await prisma.auditLog.create({
      data: {
        adminUserId: params.session.id,
        adminEmail: params.session.email,
        adminRole: params.session.role,
        action: params.action,
        targetTable: params.targetTable,
        targetId: params.targetId,
        targetLabel: params.targetLabel,
        oldValue: params.oldValue != null ? JSON.stringify(params.oldValue) : null,
        newValue: params.newValue != null ? JSON.stringify(params.newValue) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    })
  } catch (e) {
    console.error('Audit log error:', e)
  }
}

export function getIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]
    || request.headers.get('x-real-ip')
    || 'unknown'
}
