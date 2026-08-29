import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, createAuditLog, getIp } from '@/lib/admin-rbac'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const alert = await prisma.adminAlert.findUnique({
      where: { id: params.id },
    })

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    // Enrich with assignee info
    let assignee = null
    if (alert.assignedTo) {
      assignee = await prisma.adminUser.findUnique({
        where: { id: alert.assignedTo },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      })
    }

    return NextResponse.json({ alert: { ...alert, assignee } })
  } catch (error) {
    console.error('Alert GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch alert' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, assignedTo, notes, priority } = body

    const alert = await prisma.adminAlert.findUnique({ where: { id: params.id } })
    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    const isManager = ['SUPER_ADMIN', 'MANAGER'].includes(session.role)
    const isOwnAlert = alert.assignedTo === session.id

    // Regular staff can only update their own alerts
    if (!isManager && !isOwnAlert) {
      return NextResponse.json({ error: 'Cannot modify alerts assigned to other staff' }, { status: 403 })
    }

    const updateData: any = {}

    if (status) {
      const validStatuses = ['open', 'in_progress', 'resolved', 'dismissed']
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updateData.status = status
      if (status === 'resolved') {
        updateData.resolvedAt = new Date()
        updateData.resolvedBy = session.id
      }
    }

    if (assignedTo !== undefined && isManager) {
      updateData.assignedTo = assignedTo || null
    }

    if (notes !== undefined) {
      updateData.notes = notes
    }

    if (priority && isManager) {
      const validPriorities = ['urgent', 'high', 'medium', 'low']
      if (!validPriorities.includes(priority)) {
        return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
      }
      updateData.priority = priority
    }

    const updated = await prisma.adminAlert.update({
      where: { id: params.id },
      data: updateData,
    })

    // Audit log
    const ip = getIp(request)
    await createAuditLog({
      session,
      action: status === 'resolved' ? 'ALERT_RESOLVE' : status === 'dismissed' ? 'ALERT_DISMISS' : 'ALERT_ASSIGN',
      targetTable: 'AdminAlert',
      targetId: params.id,
      targetLabel: alert.title,
      oldValue: { status: alert.status, assignedTo: alert.assignedTo },
      newValue: updateData,
      ipAddress: ip,
    })

    return NextResponse.json({ alert: updated })
  } catch (error) {
    console.error('Alert PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 })
  }
}
