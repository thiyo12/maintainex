import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const location = searchParams.get('location')

    const where: any = {}

    if (user.role === 'CUSTOMER') {
      where.customerId = user.id
    }

    if (status) {
      const statuses = status.split(',')
      where.status = { in: statuses }
    }
    if (category) where.category = category
    if (location) where.location = { contains: location }

    const jobs = await prisma.jobPosting.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        bids: {
          include: { tasker: { include: { user: { select: { id: true, name: true } } } } },
          orderBy: { amount: 'asc' },
        },
        assignments: {
          include: { tasker: { include: { user: { select: { id: true, name: true } } } } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const isCustomer = user.role === 'CUSTOMER'

    const mapped = jobs.map(j => ({
      id: j.id,
      title: j.title,
      description: j.description,
      category: j.category,
      budget: j.budget,
      location: j.location,
      latitude: j.latitude,
      longitude: j.longitude,
      status: j.status,
      scheduledDate: j.scheduledDate?.toISOString(),
      createdAt: j.createdAt.toISOString(),
      customer: isCustomer ? j.customer : { ...j.customer, phone: null },
      bids: j.bids.map(b => ({
        id: b.id,
        jobId: b.jobId,
        taskerId: b.taskerId,
        amount: b.amount,
        message: b.message,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
        tasker: b.tasker ? {
          id: b.tasker.id,
          userId: b.tasker.userId,
          rating: b.tasker.rating,
          completedJobs: b.tasker.completedJobs,
          hourlyRate: b.tasker.hourlyRate,
          user: b.tasker.user,
        } : null,
      })),
      assignedTasker: j.assignments[0]?.tasker ? {
        id: j.assignments[0].tasker.id,
        userId: j.assignments[0].tasker.userId,
        rating: j.assignments[0].tasker.rating,
        completedJobs: j.assignments[0].tasker.completedJobs,
        hourlyRate: j.assignments[0].tasker.hourlyRate,
        user: j.assignments[0].tasker.user,
      } : null,
    }))

    return NextResponse.json(mapped)
  } catch (error) {
    console.error('Jobs list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked
    if (user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Only customers can post jobs' }, { status: 403 })
    }

    const { title, description, category, budget, location, latitude, longitude, scheduledDate } = await request.json()

    if (!title || !description || !category || !budget || !location) {
      return NextResponse.json({ error: 'Title, description, category, budget, and location required' }, { status: 400 })
    }

    const job = await prisma.jobPosting.create({
      data: {
        customerId: user.id,
        title,
        description,
        category,
        budget: parseFloat(budget),
        location,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      },
    })

    return NextResponse.json({
      id: job.id,
      title: job.title,
      description: job.description,
      category: job.category,
      budget: job.budget,
      location: job.location,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('Job create error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
