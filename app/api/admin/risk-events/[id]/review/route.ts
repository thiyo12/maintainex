import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import { reviewRiskEvent, type RiskEventResolution } from '@/lib/domain/admin-risk-event'
import type { AdminSession } from '@/lib/admin-types'

const VALID_RESOLUTIONS: RiskEventResolution[] = ['CONFIRMED', 'DISMISSED', 'ESCALATED', 'NO_ACTION']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'risk_events:resolve',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    if (!id || id.length > 128) {
      return NextResponse.json({ error: 'Invalid risk event ID' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const resolution = typeof body?.resolution === 'string'
      ? body.resolution.toUpperCase() as RiskEventResolution
      : '' as RiskEventResolution
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 2000) : undefined

    if (!VALID_RESOLUTIONS.includes(resolution)) {
      return NextResponse.json({ error: 'Invalid resolution' }, { status: 400 })
    }

    const event = await prisma.marketplaceRiskEvent.findUnique({
      where: { id },
      include: {
        job: {
          select: { id: true, countryCode: true },
        },
      },
    })
    if (!event) {
      return NextResponse.json({ error: 'Risk event not found' }, { status: 404 })
    }

    if (!event.job || !assertCrmCountryAllowed(security, event.job.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const session: AdminSession = {
      id: security.adminId,
      email: security.email,
      role: security.role,
      firstName: '',
      lastName: '',
      assignedCountries: security.assignedCountries,
      authType: 'adminUser',
    }

    const result = await reviewRiskEvent(prisma, {
      eventId: id,
      resolution,
      reason,
      session,
      ipAddress: security.ipAddress,
    })

    return NextResponse.json({
      success: true,
      event: result.event,
      resolution: result.resolution,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('already reviewed') || message.includes('Concurrent')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message.includes('Reason is required')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    secureConsole.error('CRM risk event review error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
