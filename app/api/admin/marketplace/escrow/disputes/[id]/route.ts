import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize } from '@/lib/admin-rbac'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const { action, resolution } = await request.json()

    if (!action || !['resolve', 'dismiss'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }

    const dispute = await prisma.dispute.findUnique({ where: { id: params.id } })
    if (!dispute) {
      return NextResponse.json({ success: false, error: 'Dispute not found' }, { status: 404 })
    }

    if (dispute.status === 'RESOLVED' || dispute.status === 'DISMISSED') {
      return NextResponse.json({ success: false, error: 'Dispute already closed' }, { status: 400 })
    }

    const newStatus = action === 'resolve' ? 'RESOLVED' : 'DISMISSED'

    await prisma.dispute.update({
      where: { id: params.id },
      data: {
        status: newStatus,
        resolution: resolution || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Dispute update error:', e)
    return NextResponse.json({ success: false, error: 'Failed to update dispute' }, { status: 500 })
  }
}
