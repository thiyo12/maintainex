import { logger } from '@/lib/shared/observability/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryFilter,
  guardCrmAction,
  guardCrmRequest,
} from '@/lib/crm/security'
import {
  evaluateActionInitiation,
  evaluateEffectivePermission,
} from '@/lib/crm/governance'
import { consumeCrmStepUpFromHeader } from '@/lib/crm/governance/step-up'
import { getWeeklySettlementAdminUpdate } from '@/lib/finance/commission/settlement-actions'

const VALID_ACTIONS = new Set(['SEND_REMINDER', 'SUSPEND', 'UNSUSPEND'])

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'finance:commission:view',
      permissionClass: 'READ',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || '').toUpperCase()
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50))
    const skip = (page - 1) * limit

    if (status && !['ALL', 'PENDING', 'PAID', 'OVERDUE', 'SUSPENDED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid settlement status' }, { status: 400 })
    }

    const countryFilter = getCrmCountryFilter(security)
    const where: any = { ...countryFilter }

    if (status && status !== 'ALL') where.status = status
    if (from || to) {
      where.weekStart = {}
      if (from) {
        const date = new Date(from)
        if (Number.isNaN(date.getTime())) {
          return NextResponse.json({ error: 'Invalid from date' }, { status: 400 })
        }
        where.weekStart.gte = date
      }
      if (to) {
        const date = new Date(to)
        if (Number.isNaN(date.getTime())) {
          return NextResponse.json({ error: 'Invalid to date' }, { status: 400 })
        }
        where.weekStart.lte = date
      }
    }

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [
      settlements,
      total,
      statusByCurrency,
      pendingThisWeekByCurrency,
    ] = await Promise.all([
      prisma.weeklySettlement.findMany({
        where,
        orderBy: { weekStart: 'desc' },
        skip,
        take: limit,
      }),
      prisma.weeklySettlement.count({ where }),
      prisma.weeklySettlement.groupBy({
        by: ['currency', 'status'],
        where: countryFilter,
        _sum: { commissionOwed: true, totalEarnings: true },
        _count: { _all: true },
      }),
      prisma.weeklySettlement.groupBy({
        by: ['currency'],
        where: {
          ...countryFilter,
          status: 'PENDING',
          weekStart: { gte: weekAgo },
        },
        _sum: { commissionOwed: true },
        _count: { _all: true },
      }),
    ])

    const summaryMap = new Map<string, {
      currency: string
      totalCommissionOwed: number
      totalCommissionPaid: number
      pendingThisWeek: number
      overdueCount: number
      suspendedCount: number
      pendingCount: number
      paidCount: number
    }>()

    const ensureSummary = (currency: string) => {
      const existing = summaryMap.get(currency)
      if (existing) return existing
      const created = {
        currency,
        totalCommissionOwed: 0,
        totalCommissionPaid: 0,
        pendingThisWeek: 0,
        overdueCount: 0,
        suspendedCount: 0,
        pendingCount: 0,
        paidCount: 0,
      }
      summaryMap.set(currency, created)
      return created
    }

    for (const row of statusByCurrency) {
      const summary = ensureSummary(row.currency)
      const amount = row._sum.commissionOwed || 0
      const count = row._count._all

      if (row.status === 'PAID') {
        summary.totalCommissionPaid += amount
        summary.paidCount += count
      } else {
        summary.totalCommissionOwed += amount
      }

      if (row.status === 'PENDING') summary.pendingCount += count
      if (row.status === 'OVERDUE') summary.overdueCount += count
      if (row.status === 'SUSPENDED') summary.suspendedCount += count
    }

    for (const row of pendingThisWeekByCurrency) {
      ensureSummary(row.currency).pendingThisWeek = row._sum.commissionOwed || 0
    }

    const providerIds = [...new Set(settlements.map(settlement => settlement.providerId))]
    const users = providerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: providerIds } },
          select: {
            id: true,
            name: true,
            email: true,
            mxId: true,
            isSuspended: true,
            suspensionReason: true,
          },
        })
      : []
    const userMap = new Map(users.map(user => [user.id, user]))

    return NextResponse.json(
      {
        settlements: settlements.map(settlement => ({
          ...settlement,
          provider: userMap.get(settlement.providerId) || null,
        })),
        summaryByCurrency: [...summaryMap.values()].sort((a, b) =>
          a.currency.localeCompare(b.currency)
        ),
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
        actions: {
          enforce: evaluateActionInitiation({
            role: security.role,
            actionId: 'finance.commission.enforce',
            overrides: security.permissionOverrides,
          }).allowed,
          remind: evaluateEffectivePermission({
            role: security.role,
            permission: 'commission:manage',
            permissionClass: 'NORMAL',
            overrides: security.permissionOverrides,
          }).allowed,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    logger.error('CRM commission read failed unexpectedly', { err: error, route: '/api/admin/financial/commission', method: 'GET' })
    return NextResponse.json({ error: 'Failed to fetch commission data' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const baseGuard = await guardCrmRequest(request, {
      permission: 'commission:manage',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!baseGuard.ok) return baseGuard.response

    const body = await request.json().catch(() => ({}))
    const settlementId = typeof body?.settlementId === 'string'
      ? body.settlementId.trim().slice(0, 128)
      : ''
    const action = typeof body?.action === 'string' ? body.action.toUpperCase() : ''

    if (!settlementId || !VALID_ACTIONS.has(action)) {
      if (action === 'MARK_PAID') {
        return NextResponse.json(
          {
            error: 'Direct Mark Paid is disabled. Confirm a recorded commission payment instead.',
            code: 'COMMISSION_PAYMENT_EVIDENCE_REQUIRED',
          },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: 'Invalid settlement action' }, { status: 400 })
    }

    const security = baseGuard.context
    const settlement = await prisma.weeklySettlement.findUnique({
      where: { id: settlementId },
    })
    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, settlement.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const provider = await prisma.user.findUnique({
      where: { id: settlement.providerId },
      select: {
        id: true,
        name: true,
        isSuspended: true,
        suspensionReason: true,
      },
    })
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    if (action === 'SEND_REMINDER') {
      if (settlement.commissionPaid || settlement.status === 'PAID') {
        return NextResponse.json({ error: 'Paid settlements do not need reminders' }, { status: 409 })
      }

      await prisma.$transaction(async tx => {
        await tx.notification.create({
          data: {
            userId: provider.id,
            title: 'MaintainEX commission payment reminder',
            body: `Your weekly commission settlement for ${settlement.weekStart.toLocaleDateString('en-LK')} is still pending. Please review your MaintainEX account.`,
            data: JSON.stringify({
              type: 'COMMISSION_REMINDER',
              settlementId: settlement.id,
            }),
          },
        })

        await tx.securityAudit.create({
          data: {
            action: 'COMMISSION_REMINDER_SENT',
            category: 'FINANCE',
            userId: security.adminId,
            userEmail: security.email,
            userRole: security.role,
            entityType: 'WeeklySettlement',
            entityId: settlement.id,
            entityName: provider.name || provider.id,
            description: 'CRM commission reminder sent to provider',
            newValue: JSON.stringify({
              providerId: provider.id,
              countryCode: settlement.countryCode,
              currency: settlement.currency,
            }),
            ipAddress: security.ipAddress,
            userAgent: security.userAgent || undefined,
            sessionId: security.sessionId,
            riskLevel: 'LOW',
            isSuspicious: false,
          },
        })
      })

      return NextResponse.json({ message: 'Reminder sent' })
    }

    const actionGuard = await guardCrmAction(request, 'finance.commission.enforce')
    if (!actionGuard.ok) return actionGuard.response

    if (
      actionGuard.context.adminId !== security.adminId ||
      actionGuard.context.sessionId !== security.sessionId
    ) {
      return NextResponse.json({ error: 'Session changed during action' }, { status: 401 })
    }

    const stepUp = await consumeCrmStepUpFromHeader({
      headerValue: request.headers.get('x-crm-step-up'),
      adminUserId: security.adminId,
      sessionId: security.sessionId,
      actionId: 'finance.commission.enforce',
    })
    if (!stepUp) {
      return NextResponse.json(
        { error: 'Step-up authentication required', code: 'STEP_UP_REQUIRED' },
        { status: 403 }
      )
    }

    const now = new Date()

    if (action === 'SUSPEND') {
      if (settlement.commissionPaid || settlement.status === 'PAID') {
        return NextResponse.json({ error: 'Paid settlements cannot be suspended' }, { status: 409 })
      }
      if (settlement.dueAt >= now) {
        return NextResponse.json(
          { error: 'Commission enforcement is only allowed after the due date' },
          { status: 409 }
        )
      }
      if (settlement.status === 'SUSPENDED') {
        return NextResponse.json({ settlement, message: 'Settlement already suspended' })
      }
      if (provider.isSuspended && provider.suspensionReason !== 'Weekly commission not paid') {
        return NextResponse.json(
          { error: 'Provider is suspended for another reason and cannot be overwritten' },
          { status: 409 }
        )
      }
    }

    if (action === 'UNSUSPEND') {
      if (settlement.status !== 'SUSPENDED') {
        return NextResponse.json(
          { error: 'Only suspended commission settlements can be reactivated' },
          { status: 409 }
        )
      }
      if (
        provider.isSuspended &&
        provider.suspensionReason &&
        provider.suspensionReason !== 'Weekly commission not paid'
      ) {
        return NextResponse.json(
          { error: 'Provider has a non-commission suspension that must remain in place' },
          { status: 409 }
        )
      }
    }

    const updateData = getWeeklySettlementAdminUpdate({
      action: action as 'SUSPEND' | 'UNSUSPEND',
      dueAt: settlement.dueAt,
      now,
    })

    const updated = await prisma.$transaction(async tx => {
      const next = await tx.weeklySettlement.update({
        where: { id: settlement.id },
        data: updateData,
      })

      if (action === 'SUSPEND') {
        await tx.user.update({
          where: { id: provider.id },
          data: {
            isSuspended: true,
            suspensionReason: 'Weekly commission not paid',
            suspendedUntil: null,
          },
        })
      } else {
        const otherSuspendedDebt = await tx.weeklySettlement.count({
          where: {
            providerId: provider.id,
            id: { not: settlement.id },
            commissionPaid: false,
            status: 'SUSPENDED',
          },
        })

        if (otherSuspendedDebt === 0 && provider.suspensionReason === 'Weekly commission not paid') {
          await tx.user.update({
            where: { id: provider.id },
            data: {
              isSuspended: false,
              suspensionReason: null,
              suspendedUntil: null,
            },
          })
        }
      }

      await tx.securityAudit.create({
        data: {
          action: action === 'SUSPEND'
            ? 'COMMISSION_ENFORCEMENT_SUSPEND'
            : 'COMMISSION_ENFORCEMENT_REACTIVATE',
          category: 'FINANCE',
          userId: security.adminId,
          userEmail: security.email,
          userRole: security.role,
          entityType: 'WeeklySettlement',
          entityId: settlement.id,
          entityName: provider.name || provider.id,
          description: action === 'SUSPEND'
            ? 'Provider suspended for overdue commission'
            : 'Commission suspension manually reactivated; debt remains',
          oldValue: JSON.stringify({
            status: settlement.status,
            commissionPaid: settlement.commissionPaid,
            providerSuspended: provider.isSuspended,
            providerSuspensionReason: provider.suspensionReason,
          }),
          newValue: JSON.stringify({
            status: next.status,
            commissionPaid: next.commissionPaid,
            countryCode: settlement.countryCode,
            currency: settlement.currency,
          }),
          ipAddress: security.ipAddress,
          userAgent: security.userAgent || undefined,
          sessionId: security.sessionId,
          riskLevel: 'HIGH',
          isSuspicious: false,
        },
      })

      return next
    })

    return NextResponse.json({ settlement: updated })
  } catch (error) {
    logger.error('CRM commission update failed unexpectedly', { err: error, route: '/api/admin/financial/commission', method: 'PATCH' })
    return NextResponse.json({ error: 'Failed to update commission settlement' }, { status: 500 })
  }
}
