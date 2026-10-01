import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyTotp } from '@/lib/admin-2fa'
import { guardCrmAction, guardCrmRequest } from '@/lib/crm/security'
import { CRM_ACTIONS, type CrmActionId } from '@/lib/crm/governance'
import { crmStepUpExpiresAt, signCrmStepUpToken } from '@/lib/crm/governance/step-up'

function parseActionId(value: unknown): CrmActionId | null {
  if (typeof value !== 'string') return null
  return Object.prototype.hasOwnProperty.call(CRM_ACTIONS, value)
    ? value as CrmActionId
    : null
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, { level: 'sensitive' })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const actionId = parseActionId(body?.actionId)
    const totpCode = typeof body?.totpCode === 'string' ? body.totpCode.trim() : ''

    if (!actionId || !/^\d{6}$/.test(totpCode)) {
      return NextResponse.json(
        { error: 'Valid actionId and 6-digit authenticator code are required.' },
        { status: 400 }
      )
    }

    // A step-up proof is only issued to a staff account that is itself
    // currently authorized to initiate the exact action.
    const actionGuard = await guardCrmAction(request, actionId)
    if (!actionGuard.ok) return actionGuard.response
    if (
      actionGuard.context.adminId !== security.adminId ||
      actionGuard.context.sessionId !== security.sessionId
    ) {
      return NextResponse.json({ error: 'Session changed during step-up.' }, { status: 401 })
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: security.adminId },
      select: {
        id: true,
        email: true,
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
      (admin.lockedUntil && admin.lockedUntil > new Date())
    ) {
      return NextResponse.json({ error: 'Admin account is not active.' }, { status: 401 })
    }

    if (!admin.totpEnabled || !admin.totpSecret) {
      return NextResponse.json(
        { error: 'Two-factor authentication must be enabled for this action.' },
        { status: 403 }
      )
    }

    const valid = await verifyTotp(totpCode, admin.totpSecret)
    if (!valid) {
      await prisma.securityAudit.create({
        data: {
          action: 'STEP_UP_FAILED',
          category: 'AUTH',
          userId: security.adminId,
          userEmail: security.email,
          userRole: security.role,
          entityType: 'CrmStepUpGrant',
          description: 'Invalid TOTP during CRM step-up authentication',
          ipAddress: security.ipAddress,
          userAgent: security.userAgent || undefined,
          riskLevel: 'HIGH',
          isSuspicious: true,
        },
      }).catch(() => undefined)

      return NextResponse.json({ error: 'Invalid authenticator code.' }, { status: 401 })
    }

    const expiresAt = crmStepUpExpiresAt()

    const grant = await prisma.$transaction(async tx => {
      const created = await tx.crmStepUpGrant.create({
        data: {
          adminUserId: security.adminId,
          sessionId: security.sessionId,
          actionId,
          expiresAt,
        },
      })

      await tx.securityAudit.create({
        data: {
          action: 'STEP_UP_VERIFIED',
          category: 'AUTH',
          userId: security.adminId,
          userEmail: security.email,
          userRole: security.role,
          entityType: 'CrmStepUpGrant',
          entityId: created.id,
          description: 'CRM step-up authentication verified',
          newValue: JSON.stringify({ actionId, expiresAt: expiresAt.toISOString() }),
          ipAddress: security.ipAddress,
          userAgent: security.userAgent || undefined,
          riskLevel: 'HIGH',
          isSuspicious: false,
        },
      })

      return created
    })

    const proof = signCrmStepUpToken({
      grantId: grant.id,
      adminUserId: security.adminId,
      sessionId: security.sessionId,
      actionId,
    })

    return NextResponse.json(
      { proof, expiresAt: expiresAt.toISOString() },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM step-up error:', error)
    return NextResponse.json({ error: 'Unable to complete step-up authentication.' }, { status: 500 })
  }
}
