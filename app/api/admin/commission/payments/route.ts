import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/auth/authorization/admin-rbac'
import {
  assertCrmCountryAllowed,
  getCrmCountryFilter,
  guardCrmRequest,
} from '@/lib/crm/security'
import type { AdminSession } from '@/lib/admin-types'

function sessionFromGuard(context: {
  adminId: string
  email: string
  role: AdminSession['role']
  assignedCountries: string[]
}): AdminSession {
  return {
    id: context.adminId,
    email: context.email,
    role: context.role,
    firstName: '',
    lastName: '',
    assignedCountries: context.assignedCountries,
    authType: 'adminUser',
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
    const referenceNumber = (searchParams.get('referenceNumber') || '').trim().slice(0, 120)
    const status = (searchParams.get('status') || 'PENDING').toUpperCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit
    const countryFilter = getCrmCountryFilter(security)

    if (referenceNumber) {
      const payment = await prisma.commissionPayment.findUnique({
        where: { referenceNumber },
        include: {
          weeklySettlement: {
            select: {
              id: true,
              weekStart: true,
              weekEnd: true,
              totalEarnings: true,
              commissionRate: true,
              commissionOwed: true,
              status: true,
              countryCode: true,
            },
          },
        },
      })
      if (!payment) {
        return NextResponse.json({ error: 'Reference not found' }, { status: 404 })
      }
      if (!assertCrmCountryAllowed(security, payment.countryCode)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ payment }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const where: any = { ...countryFilter }
    if (status && status !== 'ALL') where.status = status

    const [payments, total] = await Promise.all([
      prisma.commissionPayment.findMany({
        where,
        include: {
          weeklySettlement: {
            select: {
              id: true,
              weekStart: true,
              weekEnd: true,
              totalEarnings: true,
              commissionRate: true,
              commissionOwed: true,
              countryCode: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.commissionPayment.count({ where }),
    ])

    return NextResponse.json(
      {
        payments,
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
    console.error('CRM commission payments GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch commission payments' }, { status: 500 })
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
    const paymentId = typeof body?.paymentId === 'string' ? body.paymentId : ''
    const action = typeof body?.action === 'string' ? body.action.toUpperCase() : ''

    if (!paymentId || action !== 'CONFIRM') {
      return NextResponse.json({ error: 'Missing paymentId or invalid action' }, { status: 400 })
    }

    const payment = await prisma.commissionPayment.findUnique({
      where: { id: paymentId },
      include: {
        weeklySettlement: {
          select: {
            id: true,
            providerId: true,
            commissionPaid: true,
            status: true,
            countryCode: true,
          },
        },
      },
    })
    if (!payment) {
      return NextResponse.json({ error: 'Commission payment not found' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, payment.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (payment.status === 'CONFIRMED') {
      return NextResponse.json({ error: 'Payment already confirmed' }, { status: 409 })
    }

    const oldPaymentStatus = payment.status
    const oldSettlementPaid = payment.weeklySettlement.commissionPaid
    const oldSettlementStatus = payment.weeklySettlement.status

    const result = await prisma.$transaction([
      prisma.commissionPayment.update({
        where: { id: paymentId },
        data: {
          status: 'CONFIRMED',
          confirmedById: security.adminId,
          confirmedAt: new Date(),
        },
      }),
      prisma.weeklySettlement.update({
        where: { id: payment.weeklySettlementId },
        data: {
          commissionPaid: true,
          paidAt: new Date(),
          status: 'PAID',
        },
      }),
    ])

    await createAuditLog({
      session: sessionFromGuard(security),
      action: 'COMMISSION_PAYMENT_CONFIRM',
      targetTable: 'CommissionPayment',
      targetId: payment.id,
      targetLabel: payment.referenceNumber,
      oldValue: {
        paymentStatus: oldPaymentStatus,
        settlementCommissionPaid: oldSettlementPaid,
        settlementStatus: oldSettlementStatus,
      },
      newValue: {
        paymentStatus: 'CONFIRMED',
        settlementCommissionPaid: true,
        settlementStatus: 'PAID',
        confirmedBy: security.email,
      },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent,
    })

    return NextResponse.json({
      payment: result[0],
      settlement: result[1],
      message: 'Payment confirmed and settlement updated',
    })
  } catch (error) {
    console.error('CRM commission payment PATCH error:', error)
    return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 })
  }
}
