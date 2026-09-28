import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { name, phone, email, serviceId, jobId, district, address, date, time, notes, amount, budgetMin, budgetMax } = await request.json()

    if (!name || !phone || !district || !date || !time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!serviceId && !jobId) {
      return NextResponse.json({ error: 'serviceId or jobId required' }, { status: 400 })
    }

    let totalPrice = amount || 0
    let serviceName = ''
    if (serviceId) {
      const service = await prisma.service.findUnique({ where: { id: serviceId } })
      if (service) {
        totalPrice = service.price || totalPrice
        serviceName = service.name || ''
      }
    }

    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        serviceId: serviceId || null,
        name,
        phone,
        email: email || null,
        district,
        address: address || null,
        date: new Date(date),
        timeSlot: time,
        time: time,
        totalPrice,
        budgetMin: budgetMin ? parseFloat(budgetMin) : null,
        budgetMax: budgetMax ? parseFloat(budgetMax) : null,
        status: 'PENDING',
        notes: notes || null,
      },
    })

    if (jobId && serviceName === '') {
      const job = await prisma.jobPosting.findUnique({ where: { id: jobId } })
      if (job) serviceName = job.title
    }

    return NextResponse.json({
      booking: {
        id: booking.id,
        serviceId: booking.serviceId,
        serviceName,
        categoryName: '',
        customerName: booking.name,
        customerPhone: booking.phone,
        customerEmail: booking.email,
        district: booking.district,
        address: booking.address,
        date: booking.date?.toISOString(),
        time: booking.timeSlot,
        notes: booking.notes,
        price: booking.totalPrice,
        budgetMin: booking.budgetMin,
        budgetMax: booking.budgetMax,
        status: booking.status,
        createdAt: booking.createdAt.toISOString(),
        userId: booking.userId,
      },
    })
  } catch (error) {
    console.error('Mobile booking create error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
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
