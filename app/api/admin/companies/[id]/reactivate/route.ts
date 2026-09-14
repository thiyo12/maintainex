import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { ROLE_PERMISSIONS } from '@/lib/admin-types'
import { reactivateCompany } from '@/lib/domain/admin-suspension'
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
    if (!permissions?.includes('companies:edit')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { reason = 'Reactivated by admin' } = body

    const result = await reactivateCompany(prisma, {
      companyProfileId: id,
      reason,
      session,
      ipAddress: getIp(request),
    })

    return NextResponse.json({ success: true, company: { id: result.companyProfileId, verificationStatus: 'VERIFIED' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('not suspended')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    console.error('Company reactivate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
