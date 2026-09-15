import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { ROLE_PERMISSIONS } from '@/lib/admin-types'
import { reviewCredential } from '@/lib/domain/credential-review'
import { getIp } from '@/lib/admin-rbac'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'USER_MANAGEMENT', 'MANAGER']

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
    if (!permissions?.includes('credentials:write')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { status, reason } = body

    if (!status || !['VERIFIED', 'REJECTED', 'EXPIRED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const result = await reviewCredential(prisma, {
      credentialId: id,
      status,
      reason,
      session,
      ipAddress: getIp(request),
    })

    return NextResponse.json({ success: true, credential: result.credential, newStatus: result.newStatus })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('already in terminal state')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message.includes('Rejection reason')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('Credential review error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
