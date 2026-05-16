import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

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

    const { token } = await request.json()
    if (!token) {
      return NextResponse.json({ error: 'Push token required' }, { status: 400 })
    }

    console.log(`Push token registered for user ${user.id}: ${token}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Push register error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
