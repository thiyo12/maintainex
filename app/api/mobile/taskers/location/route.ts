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

    const { latitude, longitude } = await request.json()
    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Latitude and longitude required' }, { status: 400 })
    }

    // Device clients may send decimal strings; do not coerce null, blank,
    // boolean, arrays or objects with Number() (Number(null) === 0). Those
    // values previously overwrote a valid provider GPS position with 0,0.
    const parseCoordinate = (value: unknown): number | null => {
      if (typeof value === 'number') return Number.isFinite(value) ? value : null
      if (typeof value !== 'string') return null
      const decimal = value.trim()
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(decimal)) return null
      const parsed = Number(decimal)
      return Number.isFinite(parsed) ? parsed : null
    }
    const parsedLatitude = parseCoordinate(latitude)
    const parsedLongitude = parseCoordinate(longitude)
    if (
      parsedLatitude === null ||
      parsedLongitude === null ||
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
    secureConsole.error('Location update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
