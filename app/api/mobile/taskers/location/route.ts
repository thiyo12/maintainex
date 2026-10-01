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

    const { latitude, longitude } = await request.json()
    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Latitude and longitude required' }, { status: 400 })
    }

    const parsedLatitude = typeof latitude === 'number' ? latitude : Number(latitude)
    const parsedLongitude = typeof longitude === 'number' ? longitude : Number(longitude)
    if (
      !Number.isFinite(parsedLatitude) ||
      !Number.isFinite(parsedLongitude) ||
      parsedLatitude < -90 ||
      parsedLatitude > 90 ||
      parsedLongitude < -180 ||
      parsedLongitude > 180
    ) {
      return NextResponse.json({ error: 'Invalid latitude or longitude' }, { status: 400 })
    }

    await prisma.taskerProfile.update({
      where: { userId: user.id },
      data: {
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        locationUpdatedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Location update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
