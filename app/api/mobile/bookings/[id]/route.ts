import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: { service: { include: { category: true } } },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: booking.id,
      serviceId: booking.serviceId,
      serviceName: booking.service?.name || '',
      categoryName: booking.service?.category?.name || '',
      customerName: booking.name,
      customerPhone: booking.phone,
      customerEmail: booking.email,
      district: booking.district,
      address: booking.address,
      date: booking.date?.toISOString(),
      time: booking.timeSlot || booking.time,
      notes: booking.notes,
      price: booking.totalPrice,
      status: booking.status,
      createdAt: booking.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('Mobile booking get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
