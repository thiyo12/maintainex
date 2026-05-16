import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || user.role !== 'TASKER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { isOnline } = await request.json()
    await prisma.taskerProfile.update({
      where: { userId: user.id },
      data: { isOnline: !!isOnline },
    })

    return NextResponse.json({ success: true, isOnline: !!isOnline })
  } catch (error) {
    console.error('Status update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
