import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, getIp } from '@/lib/admin-rbac'
import { writeAuditLog } from '@/lib/admin-audit'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getSessionFromCookie(request)
    const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN'])(session)
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const alert = await prisma.adminAlert.update({
      where: { id: params.id },
      data: {
        status: body.status,
        resolvedAt: body.status === 'resolved' ? new Date() : undefined,
        resolvedBy: body.status === 'resolved' ? session!.id : undefined,
        assignedTo: body.assignedTo || undefined,
      },
    })

    await writeAuditLog({
      session: session!,
      action: 'UPDATE',
      targetTable: 'AdminAlert',
      targetId: params.id,
      newValue: { status: body.status },
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({ alert })
  } catch (error) {
    console.error('Alert update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
