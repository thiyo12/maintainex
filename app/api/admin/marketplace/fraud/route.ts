import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {}
    if (status !== 'all') where.status = status

    const [flags, total] = await Promise.all([
      prisma.adminFlag.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.adminFlag.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: flags,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Get flags error:', error)
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, action, notes } = await request.json()
    if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })

    const statusMap: Record<string, string> = {
      dismiss: 'dismissed',
      warn: 'reviewed',
      suspend: 'resolved',
      ban: 'resolved',
    }

    const flag = await prisma.adminFlag.update({
      where: { id },
      data: {
        status: statusMap[action] || 'reviewed',
        resolvedBy: session.id,
        notes: notes || null,
      },
    })

    // If suspend/ban, also update the user
    if (action === 'suspend') {
      const suspendDays = 7
      await prisma.user.update({
        where: { id: flag.userId },
        data: {
          isSuspended: true,
          suspendedUntil: new Date(Date.now() + suspendDays * 24 * 60 * 60 * 1000),
          suspensionReason: notes || 'Flagged by admin',
        },
      })
    } else if (action === 'ban') {
      await prisma.user.update({
        where: { id: flag.userId },
        data: { isActive: false },
      })
    }

    return NextResponse.json({ success: true, data: flag })
  } catch (error) {
    console.error('Resolve flag error:', error)
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
  }
}
