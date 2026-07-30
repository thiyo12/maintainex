import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const where: Record<string, unknown> = { id: params.id }
    if (user.role === 'CUSTOMER') {
      where.customerId = user.id
    }

    const job = await prisma.jobPosting.findFirst({
      where: where as any,
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
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: job.id,
      title: job.title,
      description: job.description,
      category: job.category,
      budget: job.budget,
      location: job.location,
      latitude: job.latitude,
      longitude: job.longitude,
      status: job.status,
      scheduledDate: job.scheduledDate?.toISOString(),
      createdAt: job.createdAt.toISOString(),
      customer: job.customer,
      bids: job.bids.map(b => ({
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
      assignedTasker: job.assignments[0]?.tasker ? {
        id: job.assignments[0].tasker.id,
        userId: job.assignments[0].tasker.userId,
        rating: job.assignments[0].tasker.rating,
        completedJobs: job.assignments[0].tasker.completedJobs,
        hourlyRate: job.assignments[0].tasker.hourlyRate,
        user: job.assignments[0].tasker.user,
      } : null,
    })
  } catch (error) {
    console.error('Job get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const job = await prisma.jobPosting.findUnique({ where: { id: params.id } })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Allow status updates from authorized users
    if (body.status) {
      const validTransitions: Record<string, string[]> = {
        OPEN: ['ASSIGNED', 'CANCELLED'],
        ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
        IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      }

      // Customer can cancel anytime, tasker can progress
      if (user.role === 'CUSTOMER' && job.customerId !== user.id) {
        return NextResponse.json({ error: 'Not your job' }, { status: 403 })
      }

      if (!validTransitions[job.status]?.includes(body.status)) {
        return NextResponse.json({ error: `Cannot transition from ${job.status} to ${body.status}` }, { status: 400 })
      }

      const updateData: any = { status: body.status }
      if (body.status === 'IN_PROGRESS') updateData.startedAt = new Date()
      if (body.status === 'COMPLETED') updateData.completedAt = new Date()

      await prisma.jobPosting.update({
        where: { id: params.id },
        data: { status: body.status },
      })

      // Update assignment status
      if (['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(body.status)) {
        await prisma.assignment.updateMany({
          where: { jobId: params.id, status: body.status === 'IN_PROGRESS' ? 'ASSIGNED' : undefined },
          data: { status: body.status, ...(body.status === 'IN_PROGRESS' ? { startedAt: new Date() } : {}), ...(body.status === 'COMPLETED' ? { completedAt: new Date() } : {}) },
        })
      }

      return NextResponse.json({ success: true, status: body.status })
    }

    return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
  } catch (error) {
    console.error('Job update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const job = await prisma.jobPosting.findUnique({ where: { id: params.id } })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (job.customerId !== user.id && !['SUPER_ADMIN', 'OPERATIONS', 'FINANCE'].includes(user.role)) {
      return NextResponse.json({ error: 'Not your job' }, { status: 403 })
    }

    await prisma.jobPosting.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Job delete error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
