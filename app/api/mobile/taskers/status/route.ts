import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || user.role !== 'TASKER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { isOnline } = await request.json()
    if (!!isOnline) {
      const identity = (user.identityStatus || 'NOT_SUBMITTED').toUpperCase()
      if (!['VERIFIED', 'APPROVED'].includes(identity)) {
        return NextResponse.json({ error: 'Identity verification is required before going online.' }, { status: 403 })
      }
      const profile = await prisma.taskerProfile.findUnique({
        where: { userId: user.id },
        select: { verificationStatus: true, isVerified: true },
      })
      if (!profile || profile.verificationStatus !== 'VERIFIED' || !profile.isVerified) {
        return NextResponse.json({ error: 'Tasker verification is required before going online.' }, { status: 403 })
      }
    }

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
