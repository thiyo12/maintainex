import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'
import { taskApplicationSchema } from '@/lib/validations'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession(request)
    if (!session || session.role !== 'TASKER') {
      return NextResponse.json({ error: 'Unauthorized. Tasker account required.' }, { status: 401 })
    }

    const taskerProfile = await prisma.taskerProfile.findUnique({
      where: { userId: session.id },
    })

    if (!taskerProfile) {
      return NextResponse.json({ error: 'Tasker profile not found' }, { status: 404 })
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (task.status !== 'OPEN' && task.status !== 'APPROVED') {
      return NextResponse.json({ error: 'This task is not accepting applications' }, { status: 400 })
    }

    const body = await request.json()
    const validation = taskApplicationSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { bidAmount, message, proposedDuration, availability } = validation.data

    const existing = await prisma.taskApplication.findUnique({
      where: {
        taskId_taskerId: {
          taskId: params.id,
          taskerId: taskerProfile.id,
        }
      }
    })

    if (existing) {
      return NextResponse.json({ error: 'You have already applied to this task' }, { status: 409 })
    }

    const application = await prisma.taskApplication.create({
      data: {
        taskId: params.id,
        taskerId: taskerProfile.id,
        bidAmount: bidAmount || null,
        message,
        proposedDuration: proposedDuration || null,
        availability: availability || null,
        status: 'PENDING',
      },
      include: {
        tasker: {
          include: { user: { select: { name: true, avatarUrl: true } } }
        }
      }
    })

    await prisma.task.update({
      where: { id: params.id },
      data: { applicationsCount: { increment: 1 } },
    })

    return NextResponse.json({
      success: true,
      data: application,
      message: 'Application submitted successfully!',
    }, { status: 201 })
  } catch (error) {
    console.error('Application error:', error)
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }
}
