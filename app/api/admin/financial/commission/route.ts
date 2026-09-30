import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryFilter,
  guardCrmRequest,
} from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'

const VALID_ACTIONS = new Set(['MARK_PAID', 'SEND_REMINDER', 'SUSPEND', 'UNSUSPEND'])

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
    const status = (searchParams.get('status') || '').toUpperCase()
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const skip = (page - 1) * limit

    const countryFilter = getCrmCountryFilter(security)
    const where: any = { ...countryFilter }

    if (status && status !== 'ALL') where.status = status
    if (from || to) {
      where.weekStart = {}
      if (from) {
        const date = new Date(from)
        if (Number.isNaN(date.getTime())) return NextResponse.json({ error: 'Invalid from date' }, { status: 400 })
        where.weekStart.gte = date
      }
      if (to) {
        const date = new Date(to)
        if (Number.isNaN(date.getTime())) return NextResponse.json({ error: 'Invalid to date' }, { status: 400 })
        where.weekStart.lte = date
      }
    }

    const statsWhere = countryFilter
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [
      settlements,
      total,
      allStats,
      paidStats,
      pendingStats,
      overdueStats,
      pendingThisWeek,
    ] = await Promise.all([
      prisma.weeklySettlement.findMany({
        where,
        orderBy: { weekStart: 'desc' },
        skip,
        take: limit,
      }),
      prisma.weeklySettlement.count({ where }),
      prisma.weeklySettlement.aggregate({
        where: statsWhere,
        _sum: { commissionOwed: true, totalEarnings: true },
        _count: true,
      }),
      prisma.weeklySettlement.aggregate({
        where: { ...statsWhere, status: 'PAID' },
        _sum: { commissionOwed: true, totalEarnings: true },
        _count: true,
      }),
      prisma.weeklySettlement.aggregate({
        where: { ...statsWhere, status: 'PENDING' },
        _sum: { commissionOwed: true, totalEarnings: true },
        _count: true,
      }),
      prisma.weeklySettlement.aggregate({
        where: { ...statsWhere, status: 'OVERDUE' },
        _sum: { commissionOwed: true },
        _count: true,
      }),
      prisma.weeklySettlement.aggregate({
        where: { ...statsWhere, status: 'PENDING', weekStart: { gte: weekAgo } },
        _sum: { commissionOwed: true },
        _count: true,
      }),
    ])

    const providerIds = [...new Set(settlements.map(settlement => settlement.providerId))]
    const users = providerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: providerIds } },
          select: { id: true, name: true, email: true, mxId: true },
        })
      : []
    const userMap = new Map(users.map(user => [user.id, user]))

    return NextResponse.json(
      {
        settlements: settlements.map(settlement => ({
          ...settlement,
          provider: userMap.get(settlement.providerId) || null,
        })),
        summary: {
          totalCommissionOwed: allStats._sum.commissionOwed || 0,
          totalCommissionPaid: paidStats._sum.commissionOwed || 0,
          pendingThisWeek: pendingThisWeek._sum.commissionOwed || 0,
          overdueCount: overdueStats._count,
          pendingCount: pendingStats._count,
          paidCount: paidStats._count,
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
    console.error('CRM commission GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch commission data' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'commission:manage',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const settlementId = typeof body?.settlementId === 'string' ? body.settlementId : ''
    const action = typeof body?.action === 'string' ? body.action.toUpperCase() : ''

    if (!settlementId || !VALID_ACTIONS.has(action)) {
      return NextResponse.json({ error: 'Invalid settlement action' }, { status: 400 })
    }

    const settlement = await prisma.weeklySettlement.findUnique({ where: { id: settlementId } })
    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, settlement.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const provider = await prisma.user.findUnique({
      where: { id: settlement.providerId },
      select: { id: true, name: true },
    })
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    if (action === 'SEND_REMINDER') {
      await prisma.notification.create({
        data: {
          userId: provider.id,
          title: 'MaintainEX commission payment reminder',
          body: `Your weekly commission settlement for ${settlement.weekStart.toLocaleDateString('en-LK')} is still pending. Please review your MaintainEX account.`,
          data: JSON.stringify({ type: 'COMMISSION_REMINDER', settlementId: settlement.id }),
        },
      })

      await createAuditLog({
        action: 'CREATE',
        category: 'FINANCE',
        userId: security.adminId,
        userEmail: security.email,
        userRole: security.role,
        entityType: 'WeeklySettlement',
        entityId: settlement.id,
        entityName: provider.name,
        description: 'CRM commission reminder sent to provider',
        newValue: { providerId: provider.id, action },
        ipAddress: security.ipAddress,
        userAgent: security.userAgent || undefined,
        riskLevel: 'LOW',
      })

      return NextResponse.json({ message: 'Reminder sent', settlement })
    }

    if (action === 'SUSPEND' && settlement.commissionPaid) {
      return NextResponse.json({ error: 'Paid settlements cannot be suspended' }, { status: 409 })
    }
    if (action === 'SUSPEND' && settlement.status === 'SUSPENDED') {
      return NextResponse.json({ settlement, message: 'Settlement already suspended' })
    }
    if (action === 'UNSUSPEND' && settlement.status !== 'SUSPENDED') {
      return NextResponse.json({ error: 'Only suspended settlements can be unsuspended' }, { status: 409 })
    }
    if (action === 'MARK_PAID' && settlement.commissionPaid) {
      return NextResponse.json({ settlement, message: 'Settlement already paid' })
    }

    const now = new Date()
    let updateData: Record<string, unknown> = {}
    if (action === 'MARK_PAID') {
      updateData = {
        commissionPaid: true,
        paidAt: now,
        status: 'PAID',
        suspendedAt: null,
      }
    } else if (action === 'SUSPEND') {
      updateData = {
        status: 'SUSPENDED',
        suspendedAt: now,
      }
    } else {
      updateData = {
        status: settlement.dueAt < now ? 'OVERDUE' : 'PENDING',
        commissionPaid: false,
        paidAt: null,
        suspendedAt: null,
      }
    }

    const updated = await prisma.$transaction(async tx => {
      const next = await tx.weeklySettlement.update({
        where: { id: settlementId },
        data: updateData,
      })

      if (action === 'SUSPEND') {
        await tx.user.update({
          where: { id: settlement.providerId },
          data: {
            isSuspended: true,
            suspensionReason: 'Weekly commission not paid',
            suspendedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        })
      } else if (action === 'UNSUSPEND' || action === 'MARK_PAID') {
        const providerUser = await tx.user.findUnique({
          where: { id: settlement.providerId },
          select: { suspensionReason: true },
        })
        if (providerUser?.suspensionReason === 'Weekly commission not paid') {
          await tx.user.update({
            where: { id: settlement.providerId },
            data: {
              isSuspended: false,
              suspensionReason: null,
              suspendedUntil: null,
            },
          })
        }
      }

      return next
    })

    await createAuditLog({
      action: 'UPDATE',
      category: 'FINANCE',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'WeeklySettlement',
      entityId: settlement.id,
      entityName: provider.name,
      description: `CRM weekly settlement action: ${action}`,
      oldValue: { status: settlement.status, commissionPaid: settlement.commissionPaid },
      newValue: {
        status: updated.status,
        commissionPaid: updated.commissionPaid,
        providerSuspensionChanged: action === 'SUSPEND' || action === 'UNSUSPEND',
      },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: action === 'SUSPEND' ? 'HIGH' : 'MEDIUM',
    })

    return NextResponse.json({ settlement: updated })
  } catch (error) {
    console.error('CRM commission PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update settlement' }, { status: 500 })
  }
}
