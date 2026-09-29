import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import { suspendUser } from '@/lib/domain/admin-suspension'
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
      permission: 'users:suspend',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    if (!id || id.length > 128) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 1000) : ''
    if (reason.length < 3) {
      return NextResponse.json({ error: 'Reason is required (minimum 3 characters)' }, { status: 400 })
    }

    let expiresAt: Date | undefined
    if (body?.expiresAt) {
      const parsed = new Date(body.expiresAt)
      if (Number.isNaN(parsed.getTime()) || parsed <= new Date()) {
        return NextResponse.json({ error: 'expiresAt must be a valid future date' }, { status: 400 })
      }
      expiresAt = parsed
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, countryCode: true },
    })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (!assertCrmCountryAllowed(security, target.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await suspendUser(prisma, {
      userId: id,
      reason,
      scope: 'ALL',
      expiresAt,
      session: adminSession(security),
      ipAddress: security.ipAddress,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        isSuspended: true,
        suspendedUntil: result.user.suspendedUntil,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('already suspended')) return NextResponse.json({ error: message }, { status: 409 })
    if (message.includes('not found')) return NextResponse.json({ error: message }, { status: 404 })
    console.error('CRM provider suspend error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
