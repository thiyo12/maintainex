import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryFilter,
  guardCrmRequest,
} from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'

const VALID_STATUSES = new Set(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'])

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'disputes:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || '').toUpperCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const skip = (page - 1) * limit

    if (status && status !== 'ALL' && !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
    }

    const where: any = { ...getCrmCountryFilter(security) }
    if (status && status !== 'ALL') where.status = status

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: {
          job: {
            select: { id: true, title: true, budget: true, status: true },
          },
          raisedBy: {
            select: { id: true, mxId: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.dispute.count({ where }),
    ])

    return NextResponse.json(
      {
        disputes,
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM disputes GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch disputes' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'disputes:resolve',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const disputeId = typeof body?.disputeId === 'string' ? body.disputeId : ''
    const status = typeof body?.status === 'string' ? body.status.toUpperCase() : ''
    const resolution = typeof body?.resolution === 'string' ? body.resolution.trim().slice(0, 5000) : ''

    if (!disputeId || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid dispute update payload' }, { status: 400 })
    }
    if (status === 'RESOLVED' && resolution.length < 3) {
      return NextResponse.json({ error: 'Resolution notes are required' }, { status: 400 })
    }

    const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } })
    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }

    if (!assertCrmCountryAllowed(security, dispute.countryCode || 'LK')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status,
        resolution: resolution || dispute.resolution,
      },
    })

    await createAuditLog({
      action: 'UPDATE',
      category: 'DISPUTE',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'Dispute',
      entityId: dispute.id,
      entityName: dispute.reason,
      description: `CRM dispute changed from ${dispute.status} to ${status}`,
      oldValue: { status: dispute.status, resolution: dispute.resolution },
      newValue: { status, resolution: resolution || dispute.resolution },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: status === 'RESOLVED' ? 'MEDIUM' : 'LOW',
    })

    return NextResponse.json({ dispute: updated })
  } catch (error) {
    console.error('CRM disputes PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update dispute' }, { status: 500 })
  }
}
