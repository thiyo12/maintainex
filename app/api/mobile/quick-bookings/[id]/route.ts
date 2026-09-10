import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const booking = await prisma.booking.findFirst({
      where: { id, userId: user.id },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: booking.id,
      customerId: booking.userId,
      date: booking.date.toISOString(),
      timeSlot: booking.timeSlot,
      status: booking.status,
      totalPrice: booking.totalPrice,
      address: booking.address,
      district: booking.district,
      notes: booking.notes,
      createdAt: booking.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('Quick booking get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
