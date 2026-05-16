import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        customer: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } }
        },
        assignment: {
          include: {
            tasker: {
              include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
                skills: { include: { category: true } },
              }
            }
          }
        },
        applications: {
          include: {
            tasker: {
              include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
              }
            }
          },
          orderBy: { createdAt: 'desc' },
        },
        reviews: {
          include: {
            customer: { include: { user: { select: { name: true } } } },
            tasker: { include: { user: { select: { name: true } } } },
          }
        },
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: task })
  } catch (error) {
    console.error('Task fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const task = await prisma.task.findUnique({
      where: { id: params.id },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (task.customerId) {
      const customer = await prisma.customerProfile.findUnique({
        where: { id: task.customerId },
      })
      if (customer?.userId !== session.id && !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: {
        title: body.title,
        description: body.description,
        budget: body.budget,
        budgetType: body.budgetType,
        urgency: body.urgency,
        address: body.address,
        isRemote: body.isRemote,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        isFlexibleDate: body.isFlexibleDate,
        preferredTime: body.preferredTime,
        images: body.images ? JSON.stringify(body.images) : undefined,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Task update error:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}
