import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const where: Record<string, unknown> = { id }
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

    const isOwner = user.id === job.customerId
    let viewerTaskerId: string | null = null

    if (!isOwner) {
      const tasker = await prisma.taskerProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      viewerTaskerId = tasker?.id ?? null

      if (job.status !== 'OPEN') {
        if (!viewerTaskerId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        const assignment = await prisma.assignment.findFirst({
          where: {
            jobId: job.id,
            taskerId: viewerTaskerId,
            status: { in: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
          },
          select: { id: true },
        })
        if (!assignment) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
    }

    const visibleBids = isOwner
      ? job.bids
      : viewerTaskerId
        ? job.bids.filter(bid => bid.taskerId === viewerTaskerId)
        : []

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
      customer: isOwner ? job.customer : { ...job.customer, phone: null },
      bids: visibleBids.map(b => ({
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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const targetStatus = typeof body.status === 'string' ? body.status.toUpperCase() : ''
    if (!targetStatus) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const validTransitions: Record<string, string[]> = {
      OPEN: ['ASSIGNED', 'CANCELLED'],
      ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    }

    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; customerId: string; status: string }>>`
        SELECT id, "customerId", status
        FROM "JobPosting"
        WHERE id = ${id}
        FOR UPDATE
      `
      const job = rows[0]
      if (!job) throw new Error('V1_JOB_NOT_FOUND')

      if (!validTransitions[job.status]?.includes(targetStatus)) {
        throw new Error(`V1_INVALID_TRANSITION:${job.status}:${targetStatus}`)
      }

      const isCustomerOwner = user.role === 'CUSTOMER' && job.customerId === user.id
      const viewerTasker = user.role === 'TASKER'
        ? await tx.taskerProfile.findUnique({
            where: { userId: user.id },
            select: { id: true },
          })
        : null

      if (targetStatus === 'ASSIGNED') {
        if (!isCustomerOwner) throw new Error('V1_ASSIGN_FORBIDDEN')

        const taskerId = typeof body.taskerId === 'string' ? body.taskerId.trim() : ''
        if (!taskerId) throw new Error('V1_TASKER_REQUIRED')

        const bid = await tx.bid.findUnique({
          where: { jobId_taskerId: { jobId: id, taskerId } },
          select: { id: true, status: true },
        })
        if (!bid || bid.status !== 'PENDING') throw new Error('V1_BID_NOT_AVAILABLE')

        const tasker = await tx.taskerProfile.findUnique({
          where: { id: taskerId },
          select: {
            id: true,
            verificationStatus: true,
            isVerified: true,
            user: {
              select: {
                isActive: true,
                isSuspended: true,
                isBanned: true,
                identityStatus: true,
              },
            },
          },
        })
        if (
          !tasker ||
          !tasker.user.isActive ||
          tasker.user.isSuspended ||
          tasker.user.isBanned ||
          tasker.user.identityStatus !== 'VERIFIED' ||
          tasker.verificationStatus !== 'VERIFIED' ||
          !tasker.isVerified
        ) {
          throw new Error('V1_TASKER_RESTRICTED')
        }

        const existingAssignment = await tx.assignment.findFirst({
          where: { jobId: id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
          select: { id: true },
        })
        if (existingAssignment) throw new Error('V1_ASSIGNMENT_EXISTS')

        const claimed = await tx.jobPosting.updateMany({
          where: { id, status: 'OPEN', customerId: user.id },
          data: { status: 'ASSIGNED' },
        })
        if (claimed.count !== 1) throw new Error('V1_STATE_CHANGED')

        await tx.bid.update({
          where: { id: bid.id },
          data: { status: 'ACCEPTED' },
        })
        await tx.bid.updateMany({
          where: { jobId: id, id: { not: bid.id }, status: 'PENDING' },
          data: { status: 'REJECTED' },
        })
        await tx.assignment.create({
          data: { jobId: id, taskerId, status: 'ASSIGNED' },
        })

        return { status: 'ASSIGNED' }
      }

      const activeAssignment = await tx.assignment.findFirst({
        where: {
          jobId: id,
          status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, taskerId: true, status: true },
      })
      const isAssignedTasker =
        !!viewerTasker &&
        !!activeAssignment &&
        activeAssignment.taskerId === viewerTasker.id

      if (targetStatus === 'IN_PROGRESS') {
        if (!isAssignedTasker || activeAssignment?.status !== 'ASSIGNED') {
          throw new Error('V1_START_FORBIDDEN')
        }

        const claimed = await tx.jobPosting.updateMany({
          where: { id, status: 'ASSIGNED' },
          data: { status: 'IN_PROGRESS' },
        })
        if (claimed.count !== 1) throw new Error('V1_STATE_CHANGED')

        const assignmentClaimed = await tx.assignment.updateMany({
          where: { id: activeAssignment.id, status: 'ASSIGNED', taskerId: viewerTasker!.id },
          data: { status: 'IN_PROGRESS', startedAt: new Date() },
        })
        if (assignmentClaimed.count !== 1) throw new Error('V1_ASSIGNMENT_STATE_CHANGED')

        return { status: 'IN_PROGRESS' }
      }

      if (targetStatus === 'COMPLETED') {
        if (!activeAssignment || activeAssignment.status !== 'IN_PROGRESS') {
          throw new Error('V1_ACTIVE_ASSIGNMENT_REQUIRED')
        }
        if (!isCustomerOwner && !isAssignedTasker) {
          throw new Error('V1_COMPLETE_FORBIDDEN')
        }

        const claimed = await tx.jobPosting.updateMany({
          where: { id, status: 'IN_PROGRESS' },
          data: { status: 'COMPLETED' },
        })
        if (claimed.count !== 1) throw new Error('V1_STATE_CHANGED')

        const assignmentClaimed = await tx.assignment.updateMany({
          where: { id: activeAssignment.id, status: 'IN_PROGRESS' },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })
        if (assignmentClaimed.count !== 1) throw new Error('V1_ASSIGNMENT_STATE_CHANGED')

        return { status: 'COMPLETED' }
      }

      // Cancellation is allowed for the owning customer. Once assigned, the
      // assigned tasker may also cancel their own work. No unrelated account
      // can mutate this job, and linked active assignments close atomically.
      if (targetStatus === 'CANCELLED') {
        const canCancel = isCustomerOwner || (job.status !== 'OPEN' && isAssignedTasker)
        if (!canCancel) throw new Error('V1_CANCEL_FORBIDDEN')

        const claimed = await tx.jobPosting.updateMany({
          where: { id, status: job.status },
          data: { status: 'CANCELLED' },
        })
        if (claimed.count !== 1) throw new Error('V1_STATE_CHANGED')

        await tx.assignment.updateMany({
          where: { jobId: id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
          data: { status: 'CANCELLED' },
        })
        await tx.bid.updateMany({
          where: { jobId: id, status: 'PENDING' },
          data: { status: 'REJECTED' },
        })

        return { status: 'CANCELLED' }
      }

      throw new Error('V1_INVALID_ACTION')
    })

    return NextResponse.json({ success: true, status: result.status })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'V1_JOB_NOT_FOUND') {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      if (error.message.startsWith('V1_INVALID_TRANSITION:')) {
        const [, from, to] = error.message.split(':')
        return NextResponse.json({ error: `Cannot transition from ${from} to ${to}` }, { status: 409 })
      }
      if (error.message === 'V1_TASKER_REQUIRED') {
        return NextResponse.json({ error: 'taskerId is required when accepting a bid' }, { status: 400 })
      }
      if (error.message === 'V1_BID_NOT_AVAILABLE') {
        return NextResponse.json({ error: 'Selected bid is no longer available' }, { status: 409 })
      }
      if (error.message === 'V1_TASKER_RESTRICTED') {
        return NextResponse.json({ error: 'Selected tasker is not eligible for assignment' }, { status: 409 })
      }
      if (error.message === 'V1_ASSIGNMENT_EXISTS' || error.message === 'V1_STATE_CHANGED' || error.message === 'V1_ASSIGNMENT_STATE_CHANGED') {
        return NextResponse.json({ error: 'Job state changed before the action completed' }, { status: 409 })
      }
      if (
        error.message === 'V1_ASSIGN_FORBIDDEN' ||
        error.message === 'V1_START_FORBIDDEN' ||
        error.message === 'V1_COMPLETE_FORBIDDEN' ||
        error.message === 'V1_CANCEL_FORBIDDEN'
      ) {
        return NextResponse.json({ error: 'You are not authorized to perform this job transition' }, { status: 403 })
      }
      if (error.message === 'V1_ACTIVE_ASSIGNMENT_REQUIRED') {
        return NextResponse.json({ error: 'An active in-progress assignment is required' }, { status: 409 })
      }
    }
    console.error('Job update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const job = await prisma.jobPosting.findUnique({ where: { id } })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (job.customerId !== user.id) {
      return NextResponse.json({ error: 'Not your job' }, { status: 403 })
    }
    if (job.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Active or historical jobs cannot be hard-deleted. Cancel the job instead.' },
        { status: 409 }
      )
    }

    await prisma.jobPosting.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Job delete error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
