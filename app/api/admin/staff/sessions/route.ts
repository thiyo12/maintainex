import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmAction, guardCrmRequest } from '@/lib/crm/security'
import {
  evaluateActionInitiation,
  evaluateEffectivePermission,
} from '@/lib/crm/governance'

function sessionState(session: {
  isRevoked: boolean
  expiresAt: Date
}, now: Date): 'ACTIVE' | 'REVOKED' | 'EXPIRED' {
  if (session.isRevoked) return 'REVOKED'
  if (session.expiresAt <= now) return 'EXPIRED'
  return 'ACTIVE'
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, { level: 'read' })
    if (!guard.ok) return guard.response
    const security = guard.context

    const canViewStaff = evaluateEffectivePermission({
      role: security.role,
      permission: 'staff:view',
      overrides: security.permissionOverrides,
    }).allowed
    const canRevoke = evaluateActionInitiation({
      role: security.role,
      actionId: 'staff.session.revoke',
      overrides: security.permissionOverrides,
    }).allowed

    if (!canViewStaff && !canRevoke) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    const sessions = await prisma.adminSession.findMany({
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
      take: 300,
      select: {
        id: true,
        adminUserId: true,
        ipAddress: true,
        userAgent: true,
        expiresAt: true,
        lastUsedAt: true,
        isRevoked: true,
        revokedAt: true,
        createdAt: true,
      },
    })

    const adminIds = [...new Set(sessions.map(session => session.adminUserId))]
    const admins = adminIds.length
      ? await prisma.adminUser.findMany({
          where: {
            id: { in: adminIds },
            deletedAt: null,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            totpEnabled: true,
          },
        })
      : []
    const adminMap = new Map(admins.map(admin => [admin.id, admin]))

    const rows = sessions
      .map(session => {
        const admin = adminMap.get(session.adminUserId)
        if (!admin) return null
        return {
          id: session.id,
          adminUserId: session.adminUserId,
          staffName: `${admin.firstName} ${admin.lastName}`.trim(),
          email: admin.email,
          role: admin.role,
          staffActive: admin.isActive,
          totpEnabled: admin.totpEnabled,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          createdAt: session.createdAt.toISOString(),
          lastUsedAt: session.lastUsedAt?.toISOString() || null,
          expiresAt: session.expiresAt.toISOString(),
          revokedAt: session.revokedAt?.toISOString() || null,
          state: sessionState(session, now),
          isCurrent: session.id === security.sessionId,
          protectedOwnerSession:
            admin.role === 'SUPER_ADMIN' && security.role !== 'SUPER_ADMIN',
        }
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))

    const summary = rows.reduce(
      (acc, row) => {
        if (row.state === 'ACTIVE') acc.active += 1
        else if (row.state === 'REVOKED') acc.revoked += 1
        else acc.expired += 1
        return acc
      },
      { active: 0, revoked: 0, expired: 0 }
    )

    return NextResponse.json(
      {
        sessions: rows,
        summary,
        canRevoke,
        currentSessionId: security.sessionId,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM staff sessions GET error:', error)
    return NextResponse.json({ error: 'Failed to load staff sessions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmAction(request, 'staff.session.revoke')
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : ''
    if (!sessionId || sessionId.length > 160) {
      return NextResponse.json({ error: 'Valid sessionId is required' }, { status: 400 })
    }

    const targetSession = await prisma.adminSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        adminUserId: true,
        isRevoked: true,
        expiresAt: true,
        revokedAt: true,
      },
    })
    if (!targetSession) {
      return NextResponse.json({ error: 'Staff session not found' }, { status: 404 })
    }

    const targetAdmin = await prisma.adminUser.findUnique({
      where: { id: targetSession.adminUserId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        deletedAt: true,
      },
    })
    if (!targetAdmin || targetAdmin.deletedAt) {
      return NextResponse.json({ error: 'Staff account not found' }, { status: 404 })
    }

    if (targetAdmin.role === 'SUPER_ADMIN' && security.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only SUPER_ADMIN can revoke an owner session' },
        { status: 403 }
      )
    }

    if (targetSession.isRevoked) {
      return NextResponse.json({ success: true, alreadyRevoked: true })
    }

    const revokedAt = new Date()
    await prisma.$transaction(async tx => {
      await tx.adminSession.update({
        where: { id: targetSession.id },
        data: {
          isRevoked: true,
          revokedAt,
        },
      })

      await tx.securityAudit.create({
        data: {
          action: 'STAFF_SESSION_REVOKE',
          category: 'ADMIN',
          userId: security.adminId,
          userEmail: security.email,
          userRole: security.role,
          entityType: 'AdminSession',
          entityId: targetSession.id,
          entityName: `${targetAdmin.firstName} ${targetAdmin.lastName}`.trim() || targetAdmin.email,
          description: 'CRM staff session revoked',
          oldValue: JSON.stringify({
            isRevoked: targetSession.isRevoked,
            expiresAt: targetSession.expiresAt,
          }),
          newValue: JSON.stringify({
            isRevoked: true,
            revokedAt,
          }),
          ipAddress: security.ipAddress,
          userAgent: security.userAgent || undefined,
          sessionId: security.sessionId,
          riskLevel: 'HIGH',
          isSuspicious: false,
        },
      })
    })

    return NextResponse.json({
      success: true,
      sessionId: targetSession.id,
      revokedAt: revokedAt.toISOString(),
      revokedCurrentSession: targetSession.id === security.sessionId,
    })
  } catch (error) {
    console.error('CRM staff session revoke error:', error)
    return NextResponse.json({ error: 'Failed to revoke staff session' }, { status: 500 })
  }
}
