import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/shared/observability/logger'
import { prisma } from '@/lib/prisma'
import { verifyTotp } from '@/lib/admin-2fa'
import { guardCrmRequest } from '@/lib/crm/security'
import { getIp } from '@/lib/auth/authorization/admin-rbac'

export const dynamic = 'force-dynamic'

/** Hard bound for any single database stage so a stuck call cannot hang the request. */
const STAGE_TIMEOUT_MS = 8000

function withTimeout<T>(label: string, work: Promise<T>, requestId: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      logger.error('2FA enrollment stage timed out', { stage: label, requestId })
      reject(new Error('stage-timeout'))
    }, STAGE_TIMEOUT_MS)
    work.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()
  logger.info('2FA enrollment confirm started', { requestId })
  try {
    const body = await request.json().catch(() => ({}))
    const totpCode = typeof body?.totpCode === 'string' ? body.totpCode.trim() : ''
    const enrollmentToken =
      typeof body?.enrollmentToken === 'string' ? body.enrollmentToken : null

    const { verifyStaffMfaEnrollmentToken, resolveEnrollmentSubject } =
      await import('@/lib/auth/staff-mfa-enrollment')
    const enrollmentClaims = verifyStaffMfaEnrollmentToken(enrollmentToken)
    logger.info('2FA enrollment token verified', {
      requestId,
      valid: Boolean(enrollmentClaims),
      hasToken: Boolean(enrollmentToken),
    })

    // Subject resolution: the enrollment token identifies the account only for
    // first enrollment of a super-admin that has never enrolled.
    let security: {
      adminId: string
      email: string
      role: string
      sessionId: string
      ipAddress: string
      userAgent: string | null
    }

    if (enrollmentClaims) {
      const resolved = await withTimeout(
        'resolve-enrollment-subject',
        resolveEnrollmentSubject(enrollmentClaims.sub),
        requestId
      )
      logger.info('2FA enrollment live account resolved', {
        requestId,
        ok: Boolean(resolved.ok),
      })
      if (!resolved.ok) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status })
      }
      security = {
        adminId: resolved.adminUser.id,
        email: resolved.adminUser.email,
        role: resolved.adminUser.role,
        sessionId: '',
        ipAddress: getIp(request),
        userAgent: request.headers.get('user-agent'),
      }
    } else if (enrollmentToken) {
      // A token was supplied but did not verify: never fall back to a session.
      return NextResponse.json(
        { error: 'Invalid or expired enrollment token' },
        { status: 401 }
      )
    } else {
      const guard = await guardCrmRequest(request, { level: 'sensitive' })
      if (!guard.ok) return guard.response
      security = {
        adminId: guard.context.adminId,
        email: guard.context.email,
        role: guard.context.role,
        sessionId: guard.context.sessionId,
        ipAddress: guard.context.ipAddress,
        userAgent: guard.context.userAgent,
      }
    }

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
      // Deterministic outcome. This is what a retry looks like when the
      // transaction committed but the browser never saw the response.
      logger.info('2FA enrollment already completed for this account', { requestId })
      return NextResponse.json(
        {
          success: true,
          alreadyEnabled: true,
          totpEnabled: true,
          error: 'Two-factor authentication is already enabled.',
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    if (!adminUser.totpSecret) {
      return NextResponse.json(
        { error: 'Start two-factor setup before confirming it.' },
        { status: 409 }
      )
    }

    const totpStartedAt = Date.now()
    const valid = await verifyTotp(totpCode, adminUser.totpSecret)
    logger.info('2FA enrollment TOTP verification finished', {
      requestId,
      valid,
      durationMs: Date.now() - totpStartedAt,
    })
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

    const txStartedAt = Date.now()
    await withTimeout(
      'enrollment-transaction',
      prisma.$transaction(async tx => {
      await tx.adminUser.update({
        where: { id: security.adminId },
        data: {
          totpEnabled: true,
          totpVerifiedAt: now,
        },
      })

      if (security.sessionId) {
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
      }

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
      }),
      requestId
    )
    logger.info('2FA enrollment transaction committed', {
      requestId,
      durationMs: Date.now() - txStartedAt,
    })

    return NextResponse.json(
      { success: true, totpEnabled: true },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    logger.error('2FA enrollment confirmation failed', {
      err: error,
      requestId,
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json(
      { error: 'Unable to confirm two-factor authentication.', requestId },
      { status: 500 }
    )
  }
}
