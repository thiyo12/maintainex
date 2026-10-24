import { logger } from '@/lib/shared/observability/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, getCrmCountryFilter, guardCrmAction, guardCrmRequest } from '@/lib/crm/security'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'finance:commission:view',
      permissionClass: 'READ',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || 'PENDING').trim().toUpperCase()
    const referenceNumber = (searchParams.get('referenceNumber') || '').trim().slice(0, 120)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10) || 30))

    if (!['ALL', 'PENDING', 'CONFIRMED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 })
    }

    const where: any = { ...getCrmCountryFilter(guard.context) }
    if (status !== 'ALL') where.status = status
    if (referenceNumber) where.referenceNumber = referenceNumber
    const [payments, total] = await Promise.all([
      prisma.commissionPayment.findMany({
        where,
        include: {
          weeklySettlement: { select: {
            id: true, providerId: true, weekStart: true, weekEnd: true,
            commissionOwed: true, commissionPaid: true, status: true,
            currency: true, countryCode: true, dueAt: true,
          } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.commissionPayment.count({ where }),
    ])

    return NextResponse.json({
      payments,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
      actions: { reconcile: false },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    logger.error('CRM commission payment read failed unexpectedly', {
      err: error, route: '/api/admin/financial/commission/payments', method: 'GET',
    })
    return NextResponse.json({ error: 'Failed to fetch commission payments' }, { status: 500 })
  }
}

/**
 * A provider reference or staff-entered amount cannot prove a bank credit.
 * Until an independent statement/feed match is available, leave the payment
 * pending and the commission receivable open.
 */
export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmAction(request, 'finance.commission.reconcile')
    if (!guard.ok) return guard.response

    const rateLimit = await requireFinancialRateLimit(request, 'commission-payment-confirm')
    if (rateLimit) return rateLimit

    const body = await request.json().catch(() => ({}))
    const paymentId = typeof body?.paymentId === 'string' ? body.paymentId.trim().slice(0, 128) : ''
    if (!paymentId) return NextResponse.json({ error: 'paymentId is required' }, { status: 400 })

    const payment = await prisma.commissionPayment.findUnique({
      where: { id: paymentId },
      select: { id: true, countryCode: true },
    })
    if (!payment) return NextResponse.json({ error: 'Commission payment not found' }, { status: 404 })
    if (!assertCrmCountryAllowed(guard.context, payment.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      error: 'Independent bank-credit evidence is required before commission can be marked paid.',
      code: 'BANK_CREDIT_EVIDENCE_REQUIRED',
      status: 'WAITING_BANK',
    }, { status: 409 })
  } catch (error) {
    logger.error('CRM commission payment reconciliation blocked unexpectedly', {
      err: error, route: '/api/admin/financial/commission/payments', method: 'PATCH',
    })
    return NextResponse.json({ error: 'Unable to reconcile commission payment' }, { status: 500 })
  }
}
