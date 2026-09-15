import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { ROLE_PERMISSIONS } from '@/lib/admin-types'
import { reviewRiskEvent } from '@/lib/domain/admin-risk-event'
import { getIp } from '@/lib/admin-rbac'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'MANAGER', 'SUPPORT', 'USER_MANAGEMENT']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = ROLE_PERMISSIONS[session.role as keyof typeof ROLE_PERMISSIONS]
    if (!permissions?.includes('risk_events:resolve')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { resolution, reason } = body

    if (!resolution || !['CONFIRMED', 'DISMISSED', 'ESCALATED', 'NO_ACTION'].includes(resolution)) {
      return NextResponse.json({ error: 'Invalid resolution' }, { status: 400 })
    }

    const result = await reviewRiskEvent(prisma, {
      eventId: id,
      resolution,
      reason,
      session,
      ipAddress: getIp(request),
    })

    return NextResponse.json({ success: true, event: result.event, resolution: result.resolution })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('already reviewed')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message.includes('Reason is required')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('Risk event review error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
