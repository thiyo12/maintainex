import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(
      notifications.map(n => ({
        id: n.id,
        userId: n.userId,
        title: n.title,
        body: n.body,
        data: n.data ? JSON.parse(n.data) : null,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error('Notifications list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { token } = await request.json()
    if (!token) {
      return NextResponse.json({ error: 'Push token required' }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.user.updateMany({
        where: { pushToken: token, id: { not: user.id } },
        data: { pushToken: null },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { pushToken: token },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Push register error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// Mark all of the user's notifications as read
export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updated = await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    })

    return NextResponse.json({ success: true, updated: updated.count })
  } catch (error) {
    console.error('Notifications mark-all error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}


export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await prisma.user.updateMany({
      where: { id: user.id },
      data: { pushToken: null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Push unregister error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
