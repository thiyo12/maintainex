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

    const { latitude, longitude } = await request.json()
    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Latitude and longitude required' }, { status: 400 })
    }

    const parsedLatitude = Number(latitude)
    const parsedLongitude = Number(longitude)
    if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude) || Math.abs(parsedLatitude) > 90 || Math.abs(parsedLongitude) > 180) {
      return NextResponse.json({ error: 'Invalid latitude or longitude' }, { status: 400 })
    }

    await prisma.taskerProfile.upsert({
      where: { userId: user.id },
      update: { latitude: parsedLatitude, longitude: parsedLongitude, locationUpdatedAt: new Date() },
      create: {
        userId: user.id,
        countryCode: user.countryCode || 'LK',
        verificationStatus: 'PENDING',
        isVerified: false,
        isOnline: false,
        skills: '[]',
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
