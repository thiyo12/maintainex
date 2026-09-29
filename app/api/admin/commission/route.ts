import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryFilter,
  guardCrmRequest,
} from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'

function serializeSettlement(settlement: any) {
  return {
    ...settlement,
    jobAmount: settlement.jobAmount.toString(),
    commissionAmount: settlement.commissionAmount.toString(),
  }
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'commission:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || '').trim().toUpperCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit
    const countryFilter = getCrmCountryFilter(security)
    const where: any = { ...countryFilter }

    if (status && status !== 'ALL') {
      if (!['PENDING', 'SETTLED'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      where.status = status
    }

    const [settlements, total, pendingSummary, settledSummary] = await Promise.all([
      prisma.commissionSettlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.commissionSettlement.count({ where }),
      prisma.commissionSettlement.aggregate({
        where: { ...countryFilter, status: 'PENDING' },
        _sum: { commissionAmount: true, jobAmount: true },
        _count: true,
      }),
      prisma.commissionSettlement.aggregate({
        where: { ...countryFilter, status: 'SETTLED' },
        _sum: { commissionAmount: true },
        _count: true,
      }),
    ])

    return NextResponse.json(
      {
        settlements: settlements.map(serializeSettlement),
        summary: {
          pendingCommission: (pendingSummary._sum.commissionAmount || BigInt(0)).toString(),
          pendingJobAmount: (pendingSummary._sum.jobAmount || BigInt(0)).toString(),
          pendingCount: pendingSummary._count,
          settledCommission: (settledSummary._sum.commissionAmount || BigInt(0)).toString(),
          settledCount: settledSummary._count,
        },
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
    console.error('CRM commission settlements GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch commission settlements' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'commission:manage',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const providerId = typeof body?.providerId === 'string' ? body.providerId.trim().slice(0, 128) : ''
    if (!providerId) {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 })
    }

    const countryFilter = getCrmCountryFilter(security)
    const pendingSettlements = await prisma.commissionSettlement.findMany({
      where: { providerId, status: 'PENDING', ...countryFilter },
      orderBy: { createdAt: 'asc' },
    })

    if (!pendingSettlements.length) {
      return NextResponse.json({ settlements: [], totalCommission: '0', count: 0, message: 'No pending settlements' })
    }

    const ids = pendingSettlements.map(item => item.id)
    const totalCommission = pendingSettlements.reduce(
      (sum, item) => sum + item.commissionAmount,
      BigInt(0)
    )

    const settled = await prisma.$transaction(async tx => {
      await tx.commissionSettlement.updateMany({
        where: {
          id: { in: ids },
          providerId,
          status: 'PENDING',
        },
        data: { status: 'SETTLED', settledAt: new Date() },
      })

      return tx.commissionSettlement.findMany({
        where: { id: { in: ids } },
        orderBy: { createdAt: 'asc' },
      })
    })

    await createAuditLog({
      action: 'UPDATE',
      category: 'FINANCE',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'CommissionSettlement',
      entityName: providerId,
      description: `CRM bulk commission settlement completed for ${settled.length} scoped records`,
      oldValue: { ids, statuses: pendingSettlements.map(item => item.status) },
      newValue: { ids, status: 'SETTLED', totalCommission: totalCommission.toString() },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'HIGH',
    })

    return NextResponse.json({
      settlements: settled.map(serializeSettlement),
      totalCommission: totalCommission.toString(),
      count: settled.length,
    })
  } catch (error) {
    console.error('CRM commission settlements POST error:', error)
    return NextResponse.json({ error: 'Failed to settle commission' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'commission:manage',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const settlementId = typeof body?.settlementId === 'string' ? body.settlementId.trim().slice(0, 128) : ''
    const action = typeof body?.action === 'string' ? body.action.toUpperCase() : ''

    if (!settlementId || action !== 'MARK_SETTLED') {
      return NextResponse.json({ error: 'Invalid settlement action' }, { status: 400 })
    }

    const settlement = await prisma.commissionSettlement.findUnique({ where: { id: settlementId } })
    if (!settlement) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 })
    if (!assertCrmCountryAllowed(security, settlement.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (settlement.status === 'SETTLED') {
      return NextResponse.json({ settlement: serializeSettlement(settlement), message: 'Already settled' })
    }
    if (settlement.status !== 'PENDING') {
      return NextResponse.json({ error: `Cannot settle record in status ${settlement.status}` }, { status: 409 })
    }

    const updated = await prisma.commissionSettlement.update({
      where: { id: settlementId },
      data: { status: 'SETTLED', settledAt: new Date() },
    })

    await createAuditLog({
      action: 'UPDATE',
      category: 'FINANCE',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'CommissionSettlement',
      entityId: settlement.id,
      entityName: settlement.providerId,
      description: 'CRM commission settlement marked settled',
      oldValue: { status: settlement.status },
      newValue: { status: updated.status, settledAt: updated.settledAt },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'HIGH',
    })

    return NextResponse.json({ settlement: serializeSettlement(updated) })
  } catch (error) {
    console.error('CRM commission settlement PUT error:', error)
    return NextResponse.json({ error: 'Failed to update settlement' }, { status: 500 })
  }
}
