import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmAction } from '@/lib/crm/security'
import { consumeCrmStepUpFromHeader } from '@/lib/crm/governance/step-up'

function normalizeMarket(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return 'GLOBAL'
  if (typeof value !== 'string') return null
  const market = value.trim().toUpperCase()
  return market === 'GLOBAL' || /^[A-Z]{2}$/.test(market) ? market : null
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmAction(request, 'breakglass.payouts.freeze')
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const market = normalizeMarket(body?.market)
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 1000) : ''
    const durationMinutesRaw = Number(body?.durationMinutes ?? 60)
    const durationMinutes = Number.isFinite(durationMinutesRaw)
      ? Math.trunc(durationMinutesRaw)
      : 60

    if (!market) {
      return NextResponse.json({ error: 'Invalid market' }, { status: 400 })
    }
    if (reason.length < 8) {
      return NextResponse.json(
        { error: 'A clear emergency reason is required.' },
        { status: 400 }
      )
    }
    if (durationMinutes < 5 || durationMinutes > 1440) {
      return NextResponse.json(
        { error: 'Freeze duration must be between 5 and 1440 minutes.' },
        { status: 400 }
      )
    }

    const stepUp = await consumeCrmStepUpFromHeader({
      headerValue: request.headers.get('x-crm-step-up'),
      adminUserId: security.adminId,
      sessionId: security.sessionId,
      actionId: 'breakglass.payouts.freeze',
    })
    if (!stepUp) {
      return NextResponse.json({ error: 'Step-up authentication required' }, { status: 403 })
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + durationMinutes * 60_000)

    const control = await prisma.$transaction(async tx => {
      const saved = await tx.crmEmergencyControl.upsert({
        where: {
          controlKey_market: {
            controlKey: 'PAYOUTS_FROZEN',
            market,
          },
        },
        update: {
          active: true,
          reason,
          activatedBy: security.adminId,
          activatedAt: now,
          expiresAt,
          deactivatedBy: null,
          deactivatedAt: null,
        },
        create: {
          controlKey: 'PAYOUTS_FROZEN',
          market,
          active: true,
          reason,
          activatedBy: security.adminId,
          activatedAt: now,
          expiresAt,
        },
      })

      await tx.securityAudit.create({
        data: {
          action: 'BREAK_GLASS_PAYOUTS_FREEZE',
          category: 'SECURITY',
          userId: security.adminId,
          userEmail: security.email,
          userRole: security.role,
          entityType: 'CrmEmergencyControl',
          entityId: saved.id,
          entityName: `PAYOUTS_FROZEN:${market}`,
          description: 'Emergency payout freeze activated',
          newValue: JSON.stringify({
            market,
            expiresAt: expiresAt.toISOString(),
            reason,
          }),
          ipAddress: security.ipAddress,
          userAgent: security.userAgent || undefined,
          riskLevel: 'CRITICAL',
          isSuspicious: false,
        },
      })

      return saved
    })

    return NextResponse.json(
      {
        control: {
          id: control.id,
          controlKey: control.controlKey,
          market: control.market,
          active: control.active,
          activatedAt: control.activatedAt,
          expiresAt: control.expiresAt,
        },
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    secureConsole.error('CRM break-glass payout freeze error:', error)
    return NextResponse.json({ error: 'Unable to activate payout freeze.' }, { status: 500 })
  }
}
