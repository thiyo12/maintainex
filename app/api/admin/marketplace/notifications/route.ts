import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize } from '@/lib/admin-rbac'

export async function GET(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!

  try {
    const notifications = await prisma.adminNotification.findMany({
      where: { adminUserId: session.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const unreadCount = await prisma.adminNotification.count({
      where: { adminUserId: session.id, read: false },
    })

    return NextResponse.json({
      success: true,
      data: notifications.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    })
  } catch (e) {
    console.error('Notifications error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!

  try {
    const { ids, all } = await request.json()

    if (all) {
      await prisma.adminNotification.updateMany({
        where: { adminUserId: session.id, read: false },
        data: { read: true },
      })
    } else if (Array.isArray(ids)) {
      await prisma.adminNotification.updateMany({
        where: { id: { in: ids }, adminUserId: session.id },
        data: { read: true },
      })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Notifications update error:', e)
    return NextResponse.json({ success: false, error: 'Failed to update notifications' }, { status: 500 })
  }
}
