import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/authentication/admin-auth'
import { getCountryFilter } from '@/lib/auth/authorization/admin-rbac'
import { createAuditLog, getIp } from '@/lib/auth/authorization/admin-rbac'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'FINANCE']

function getAdminId(session: any): string {
  return session.id || session.sub || ''
}

// GET: Search commission payments by reference number or list all pending
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const referenceNumber = searchParams.get('referenceNumber')
    const status = searchParams.get('status') || 'PENDING'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const countryFilter = getCountryFilter(session)

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
            }
          }
        }
      })

      if (!payment) {
        return NextResponse.json({ error: 'Reference not found' }, { status: 404 })
      }

      if (session.role !== 'SUPER_ADMIN' && countryFilter.countryCode) {
        if (!countryFilter.countryCode.in?.includes(payment.weeklySettlement?.countryCode || 'LK')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }

      return NextResponse.json({ payment })
    }

    const where: any = { ...countryFilter }
    if (status) where.status = status

    const payments = await prisma.commissionPayment.findMany({
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
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })

    const total = await prisma.commissionPayment.count({ where })

    return NextResponse.json({
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      }
    })
  } catch (error) {
    console.error('Commission payments GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch commission payments' }, { status: 500 })
  }
}

// PATCH: Mark a commission payment as CONFIRMED
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { paymentId, action } = body

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
          }
        }
      }
    })

    if (!payment) {
      return NextResponse.json({ error: 'Commission payment not found' }, { status: 404 })
    }

    if (session.role !== 'SUPER_ADMIN') {
      const countryFilter = getCountryFilter(session)
      if (countryFilter.id === '__NONE__') {
        return NextResponse.json({ error: 'No country assigned' }, { status: 403 })
      }
      if (countryFilter.countryCode && !countryFilter.countryCode.in?.includes(payment.weeklySettlement?.countryCode || 'LK')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (payment.status === 'CONFIRMED') {
      return NextResponse.json({ error: 'Payment already confirmed' }, { status: 400 })
    }

    const oldPaymentStatus = payment.status
    const oldSettlementPaid = payment.weeklySettlement.commissionPaid
    const oldSettlementStatus = payment.weeklySettlement.status

    const result = await prisma.$transaction([
      prisma.commissionPayment.update({
        where: { id: paymentId },
        data: {
          status: 'CONFIRMED',
          confirmedById: getAdminId(session),
          confirmedAt: new Date(),
        }
      }),
      prisma.weeklySettlement.update({
        where: { id: payment.weeklySettlementId },
        data: {
          commissionPaid: true,
          paidAt: new Date(),
          status: 'PAID',
        }
      })
    ])

    await createAuditLog({
      session: { ...session, id: getAdminId(session) } as any,
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
        confirmedBy: session.email,
      },
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({
      payment: result[0],
      settlement: result[1],
      message: 'Payment confirmed and settlement updated'
    })
  } catch (error) {
    console.error('Commission payment PATCH error:', error)
    return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 })
  }
}
