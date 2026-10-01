import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'

export async function POST(request: NextRequest) {
  const user = await authenticateRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const blocked = assertNotSuspended(user)
  if (blocked) return blocked

  return NextResponse.json(
    {
      error: 'Legacy booking creation is disabled. Create a marketplace job through /api/mobile/v2/jobs.',
      code: 'LEGACY_BOOKING_DISABLED',
    },
    { status: 410 }
  )
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const where: any = { userId: user.id }
    if (status) where.status = status

    const bookings = await prisma.booking.findMany({
      where,
      include: { service: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(
      bookings.map(b => ({
        id: b.id,
        serviceId: b.serviceId,
        serviceName: b.service?.name || '',
        categoryName: b.service?.category?.name || '',
        customerName: b.name,
        customerPhone: b.phone,
        customerEmail: b.email,
        district: b.district,
        address: b.address,
        date: b.date?.toISOString(),
        time: b.timeSlot || b.time,
        notes: b.notes,
        price: b.totalPrice,
        budgetMin: b.budgetMin,
        budgetMax: b.budgetMax,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error('Mobile bookings list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
