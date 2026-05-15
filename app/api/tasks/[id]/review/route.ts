import { NextRequest, NextResponse } from 'next/server'
import { TaskStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'
import { createNotification } from '@/lib/notifications'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession(request)
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, adminNotes } = body

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: { customer: true },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const adminProfile = await prisma.adminProfile.findUnique({
      where: { userId: session.id },
    })

    let newStatus: TaskStatus
    let rejectionReason: string | null = null

    if (action === 'approve') {
      newStatus = 'OPEN'
    } else if (action === 'reject') {
      newStatus = 'CANCELLED'
      rejectionReason = adminNotes || 'Task did not meet our guidelines'
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: {
        status: newStatus,
        adminNotes: adminNotes || null,
        reviewedBy: adminProfile?.id || null,
        reviewedAt: new Date(),
        rejectionReason,
        publishedAt: action === 'approve' ? new Date() : undefined,
      },
    })

    // Create notification for customer
    if (task.customer) {
      await createNotification(
        task.customer.userId,
        action === 'approve' ? 'TASK_APPROVED' : 'TASK_REJECTED',
        action === 'approve' ? 'Task Approved!' : 'Task Rejected',
        action === 'approve'
          ? `Your task "${task.title}" has been approved and is now visible to taskers.`
          : `Your task "${task.title}" was not approved. ${adminNotes ? `Reason: ${adminNotes}` : ''}`,
        { taskId: task.id }
      )
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: action === 'approve' ? 'Task approved and published!' : 'Task rejected',
    })
  } catch (error) {
    console.error('Task review error:', error)
    return NextResponse.json({ error: 'Failed to review task' }, { status: 500 })
  }
}
