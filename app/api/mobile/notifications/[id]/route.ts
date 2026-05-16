import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notification = await prisma.notification.findUnique({ where: { id: params.id } })
    if (!notification || notification.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.notification.update({
      where: { id: params.id },
      data: { read: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Notification read error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
