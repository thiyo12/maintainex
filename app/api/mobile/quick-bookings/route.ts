import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Only customers can book' }, { status: 403 })
    }

    const { jobId, taskerId, date, timeSlot, address, district, notes } = await request.json()

    if (!jobId || !taskerId || !date || !timeSlot || !address) {
      return NextResponse.json({ error: 'jobId, taskerId, date, timeSlot, and address are required' }, { status: 400 })
    }

    const templateJob = await prisma.templateJob.findUnique({ where: { id: jobId } })
    if (!templateJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const tasker = await prisma.taskerProfile.findUnique({ where: { id: taskerId } })
    if (!tasker) {
      return NextResponse.json({ error: 'Tasker not found' }, { status: 404 })
    }

    const avgPrice = (templateJob.priceMin + templateJob.priceMax) / 2

    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        date: new Date(date),
        timeSlot,
        totalPrice: avgPrice,
        name: user.name,
        phone: user.phone || '',
        district,
        address,
        notes,
        status: 'CONFIRMED',
      },
    })

    return NextResponse.json({
      id: booking.id,
      jobId,
      taskerId,
      customerId: user.id,
      date: booking.date.toISOString(),
      timeSlot: booking.timeSlot,
      status: booking.status,
      totalPrice: booking.totalPrice,
      createdAt: booking.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('Quick booking error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
