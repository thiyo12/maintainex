import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const count = await prisma.notification.count({
      where: { userId: user.id, read: false },
    })

    return NextResponse.json({ count })
  } catch (error) {
    secureConsole.error('Notifications unread count error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}