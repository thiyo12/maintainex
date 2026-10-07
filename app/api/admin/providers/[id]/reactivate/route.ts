import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import { reactivateUser } from '@/lib/domain/admin-suspension'
import type { AdminSession } from '@/lib/admin-types'

function adminSession(context: {
  adminId: string
  email: string
  role: AdminSession['role']
  assignedCountries: string[]
}): AdminSession {
  return {
    id: context.adminId,
    email: context.email,
    role: context.role,
    firstName: '',
    lastName: '',
    assignedCountries: context.assignedCountries,
    authType: 'adminUser',
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'taskers:edit',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    if (!id || id.length > 128) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const reason = typeof body?.reason === 'string'
      ? body.reason.trim().slice(0, 1000)
      : 'Reactivated by admin'

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        countryCode: true,
        taskerProfile: { select: { id: true } },
      },
    })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (target.role !== 'TASKER' || !target.taskerProfile) {
      return NextResponse.json({ error: 'Tasker profile not found' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, target.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await reactivateUser(prisma, {
      userId: id,
      reason,
      session: adminSession(security),
      ipAddress: security.ipAddress,
    })

    return NextResponse.json({
      success: true,
      user: { id: result.user.id, isSuspended: false },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('not suspended')) return NextResponse.json({ error: message }, { status: 409 })
    if (message.includes('not found')) return NextResponse.json({ error: message }, { status: 404 })
    secureConsole.error('CRM provider reactivate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
