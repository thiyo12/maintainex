import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { ROLE_PERMISSIONS } from '@/lib/admin-types'
import { suspendUser } from '@/lib/domain/admin-suspension'
import { getIp } from '@/lib/admin-rbac'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'USER_MANAGEMENT', 'MANAGER']

export async function POST(
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
    if (!permissions?.includes('users:suspend')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { reason, expiresAt } = body

    if (!reason || reason.trim().length < 3) {
      return NextResponse.json({ error: 'Reason is required (minimum 3 characters)' }, { status: 400 })
    }

    const result = await suspendUser(prisma, {
      userId: id,
      reason: reason.trim(),
      scope: 'ALL',
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      session,
      ipAddress: getIp(request),
    })

    return NextResponse.json({ success: true, user: { id: result.user.id, isSuspended: true } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('already suspended')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message.includes('banned')) {
      return NextResponse.json({ error: message }, { status: 422 })
    }
    console.error('Provider suspend error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
