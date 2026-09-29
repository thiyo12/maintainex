import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'dashboard:view',
      level: 'read',
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30')))

    const where = {
      adminUserId: security.adminId,
      ...(unreadOnly ? { read: false } : {}),
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.adminNotification.count({
        where: { adminUserId: security.adminId, read: false },
      }),
    ])

    return NextResponse.json(
      { notifications, unreadCount },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM admin notifications GET error:', error)
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'dashboard:view',
      level: 'mutation',
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const all = body?.all === true
    const id = typeof body?.id === 'string' ? body.id : ''

    if (!all && !id) {
      return NextResponse.json({ error: 'Notification id or all=true is required' }, { status: 400 })
    }

    if (all) {
      await prisma.adminNotification.updateMany({
        where: { adminUserId: security.adminId, read: false },
        data: { read: true },
      })
    } else {
      const result = await prisma.adminNotification.updateMany({
        where: { id, adminUserId: security.adminId },
        data: { read: true },
      })
      if (result.count === 0) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
      }
    }

    const unreadCount = await prisma.adminNotification.count({
      where: { adminUserId: security.adminId, read: false },
    })

    return NextResponse.json({ success: true, unreadCount })
  } catch (error) {
    console.error('CRM admin notifications PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
  }
}
