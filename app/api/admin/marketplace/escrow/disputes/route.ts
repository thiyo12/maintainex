import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, getIp } from '@/lib/admin-rbac'

export async function GET(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const disputes = await prisma.dispute.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        job: { select: { id: true, title: true } },
        raisedBy: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: disputes.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error('Disputes error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch disputes' }, { status: 500 })
  }
}
