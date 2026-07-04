import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, getIp } from '@/lib/admin-rbac'
import { writeAuditLog, createAlert } from '@/lib/admin-audit'

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
    const dispute = await prisma.dispute.update({
      where: { id: params.id },
      data: { status: body.status },
    })

    await writeAuditLog({
      session: session!,
      action: 'UPDATE',
      targetTable: 'Dispute',
      targetId: params.id,
      newValue: { status: body.status },
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({ dispute })
  } catch (error) {
    console.error('Dispute update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
