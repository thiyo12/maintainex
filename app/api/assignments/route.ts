import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'
import { taskAssignmentSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = taskAssignmentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { taskId, taskerId, agreedPrice, agreedDuration, startDate, endDate } = validation.data

    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const existingAssignment = await prisma.taskAssignment.findUnique({
      where: { taskId },
    })
    if (existingAssignment) {
      return NextResponse.json({ error: 'Task already has an assignment' }, { status: 409 })
    }

    const adminProfile = await prisma.adminProfile.findUnique({
      where: { userId: session.id },
    })

    const assignment = await prisma.taskAssignment.create({
      data: {
        taskId,
        taskerId,
        customerId: task.customerId,
        agreedPrice,
        agreedDuration: agreedDuration || null,
        assignedBy: adminProfile?.id || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: 'PENDING',
      },
      include: {
        tasker: { include: { user: { select: { name: true, phone: true } } } },
        task: true,
      }
    })

    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'OPEN',
      }
    })

    return NextResponse.json({
      success: true,
      data: assignment,
      message: 'Task assigned successfully!',
    }, { status: 201 })
  } catch (error) {
    console.error('Assignment error:', error)
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
  }
}
