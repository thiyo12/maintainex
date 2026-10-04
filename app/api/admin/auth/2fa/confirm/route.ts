import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/shared/observability/logger'
import { prisma } from '@/lib/prisma'
import { verifyTotp } from '@/lib/admin-2fa'
import { guardCrmRequest } from '@/lib/crm/security'

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, { level: 'sensitive' })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const totpCode = typeof body?.totpCode === 'string' ? body.totpCode.trim() : ''

    if (!/^\d{6}$/.test(totpCode)) {
      return NextResponse.json(
        { error: 'A valid 6-digit authenticator code is required.' },
        { status: 400 }
      )
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: security.adminId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        deletedAt: true,
        lockedUntil: true,
        totpEnabled: true,
        totpSecret: true,
      },
    })

    if (
      !adminUser ||
      !adminUser.isActive ||
      adminUser.deletedAt ||
      (adminUser.lockedUntil && adminUser.lockedUntil > new Date())
    ) {
      return NextResponse.json({ error: 'Account is not active.' }, { status: 401 })
    }

    if (adminUser.totpEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is already enabled.' },
        { status: 409 }
      )
    }

    if (!adminUser.totpSecret) {
      return NextResponse.json(
        { error: 'Start two-factor setup before confirming it.' },
        { status: 409 }
      )
    }

    const valid = await verifyTotp(totpCode, adminUser.totpSecret)
    if (!valid) {
      await prisma.securityAudit.create({
        data: {
          action: '2FA_ENROLLMENT_FAILED',
          category: 'AUTH',
          userId: security.adminId,
          userEmail: security.email,
          userRole: security.role,
          entityType: 'AdminUser',
          entityId: security.adminId,
          description: 'Invalid TOTP code during 2FA enrollment confirmation',
          ipAddress: security.ipAddress,
          userAgent: security.userAgent || undefined,
          riskLevel: 'HIGH',
          isSuspicious: true,
        },
      }).catch(() => undefined)

      return NextResponse.json({ error: 'Invalid authenticator code.' }, { status: 401 })
    }

    const now = new Date()

    await prisma.$transaction(async tx => {
      await tx.adminUser.update({
        where: { id: security.adminId },
        data: {
          totpEnabled: true,
          totpVerifiedAt: now,
        },
      })

      await tx.adminSession.updateMany({
        where: {
          adminUserId: security.adminId,
          id: { not: security.sessionId },
          isRevoked: false,
        },
        data: {
          isRevoked: true,
          revokedAt: now,
        },
      })

      await tx.securityAudit.create({
        data: {
          action: '2FA_ENABLED',
          category: 'AUTH',
          userId: security.adminId,
          userEmail: security.email,
          userRole: security.role,
          entityType: 'AdminUser',
          entityId: security.adminId,
          description: 'Two-factor authentication enabled',
          ipAddress: security.ipAddress,
          userAgent: security.userAgent || undefined,
          riskLevel: 'HIGH',
          isSuspicious: false,
        },
      })
    })

    return NextResponse.json(
      { success: true, totpEnabled: true },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    logger.error('2FA enrollment confirmation failed unexpectedly', { err: error })
    return NextResponse.json(
      { error: 'Unable to confirm two-factor authentication.' },
      { status: 500 }
    )
  }
}
