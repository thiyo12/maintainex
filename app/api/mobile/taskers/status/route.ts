import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || user.role !== 'TASKER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { isOnline } = await request.json()
    if (typeof isOnline !== 'boolean') {
      return NextResponse.json({ error: 'isOnline must be a boolean' }, { status: 400 })
    }

    await prisma.taskerProfile.update({
      where: { userId: user.id },
      data: { isOnline },
    })

    return NextResponse.json({ success: true, isOnline })
  } catch (error) {
    secureConsole.error('Status update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
