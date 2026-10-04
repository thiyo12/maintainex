import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAccessToken } from '../authentication/admin-jwt'
import { verifySimpleToken } from '../authentication/admin-auth'
import type { AdminRole, AuditAction, AdminSession } from '../../admin-types'


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
  return getTrustedClientIp(request.headers)
}
