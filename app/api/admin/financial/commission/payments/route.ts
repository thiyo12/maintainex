import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryFilter,
  guardCrmAction,
  guardCrmRequest,
} from '@/lib/crm/security'
import { consumeCrmStepUpFromHeader } from '@/lib/crm/governance/step-up'
import { evaluateActionInitiation } from '@/lib/crm/governance'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'
import { settleProviderReceivablesFromDirectPayment } from '@/lib/finance/commissions/provider-balance-service'
import { minorUnitsToMajorUnits, parseMajorUnitsInput, type Currency } from '@/lib/shared/money/money'

function amountMatches(paymentAmount: number, commissionOwed: number): boolean {
  return Math.abs(paymentAmount - commissionOwed) < 0.005
}

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
    const status = (searchParams.get('status') || 'PENDING').trim().toUpperCase()
    const referenceNumber = (searchParams.get('referenceNumber') || '').trim().slice(0, 120)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10) || 30))

    if (!['ALL', 'PENDING', 'CONFIRMED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 })
    }

    const countryFilter = getCrmCountryFilter(security)
    const where: any = { ...countryFilter }
    if (status !== 'ALL') where.status = status
    if (referenceNumber) where.referenceNumber = referenceNumber

    const [payments, total] = await Promise.all([
      prisma.commissionPayment.findMany({
        where,
        include: {
          weeklySettlement: {
            select: {
              id: true,
              providerId: true,
              weekStart: true,
              weekEnd: true,
              commissionOwed: true,
              commissionPaid: true,
              status: true,
              currency: true,
              countryCode: true,
              dueAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
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
        actions: {
          reconcile: evaluateActionInitiation({
            role: security.role,
            actionId: 'finance.commission.reconcile',
            overrides: security.permissionOverrides,
          }).allowed,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM commission payment GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch commission payments' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmAction(request, 'finance.commission.reconcile')
    if (!guard.ok) return guard.response
    const security = guard.context

    const rateLimit = await requireFinancialRateLimit(request, 'commission-payment-confirm')
    if (rateLimit) return rateLimit

    const body = await request.json().catch(() => ({}))
    const paymentId = typeof body?.paymentId === 'string'
      ? body.paymentId.trim().slice(0, 128)
      : ''

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId is required' }, { status: 400 })
    }

    const payment = await prisma.commissionPayment.findUnique({
      where: { id: paymentId },
      include: {
        weeklySettlement: {
          select: {
            id: true,
            providerId: true,
            commissionOwed: true,
            commissionPaid: true,
            status: true,
            providerType: true,
            currency: true,
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
    if (payment.status !== 'PENDING') {
      return NextResponse.json({ error: `Cannot confirm payment in status ${payment.status}` }, { status: 409 })
    }
    if (payment.providerId !== payment.weeklySettlement.providerId) {
      return NextResponse.json({ error: 'Payment provider does not match settlement' }, { status: 409 })
    }
    if (
      payment.countryCode !== payment.weeklySettlement.countryCode ||
      payment.currency !== payment.weeklySettlement.currency
    ) {
      return NextResponse.json({ error: 'Payment market/currency does not match settlement' }, { status: 409 })
    }
    const currency = payment.currency as Currency
    const openReceivables = await prisma.providerCommissionReceivable.findMany({
      where: {
        weeklySettlementId: payment.weeklySettlementId,
        currency: payment.currency,
        status: { in: ['OPEN', 'PARTIAL'] },
        amountRemaining: { gt: 0 },
      },
      select: { amountRemaining: true },
    })
    const remainingReceivableMinor = openReceivables.reduce(
      (sum, item) => sum + item.amountRemaining,
      0n,
    )
    const expectedPaymentAmount = openReceivables.length > 0
      ? minorUnitsToMajorUnits(remainingReceivableMinor, currency)
      : payment.weeklySettlement.commissionOwed

    if (!amountMatches(payment.amountDue, expectedPaymentAmount)) {
      return NextResponse.json(
        {
          error: 'Payment amount does not match the remaining commission due',
          expectedAmount: expectedPaymentAmount,
          currency: payment.currency,
        },
        { status: 409 },
      )
    }

    const paymentAmountMinor = parseMajorUnitsInput(payment.amountDue, currency)
    if (paymentAmountMinor === null) {
      return NextResponse.json({ error: 'Invalid commission payment amount' }, { status: 409 })
    }

    const stepUp = await consumeCrmStepUpFromHeader({
      headerValue: request.headers.get('x-crm-step-up'),
      adminUserId: security.adminId,
      sessionId: security.sessionId,
      actionId: 'finance.commission.reconcile',
    })
    if (!stepUp) {
      return NextResponse.json(
        { error: 'Step-up authentication required', code: 'STEP_UP_REQUIRED' },
        { status: 403 }
      )
    }

    const now = new Date()

    const result = await prisma.$transaction(async tx => {
      const claimed = await tx.commissionPayment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: {
          status: 'CONFIRMED',
          confirmedById: security.adminId,
          confirmedAt: now,
        },
      })

      if (claimed.count !== 1) {
        throw new Error('COMMISSION_PAYMENT_CONCURRENTLY_PROCESSED')
      }

      const settlement = await tx.weeklySettlement.findUnique({
        where: { id: payment.weeklySettlementId },
        select: {
          id: true,
          providerId: true,
          commissionPaid: true,
          status: true,
        },
      })
      if (!settlement) throw new Error('SETTLEMENT_NOT_FOUND')

      const receivableReconciliation = await settleProviderReceivablesFromDirectPayment(tx, {
        weeklySettlementId: payment.weeklySettlementId,
        commissionPaymentId: payment.id,
        amountPaidMinor: paymentAmountMinor,
        currency: payment.currency,
        createdBy: security.adminId,
      })

      if (!settlement.commissionPaid) {
        await tx.weeklySettlement.update({
          where: { id: settlement.id },
          data: {
            commissionPaid: true,
            paidAt: now,
            status: 'PAID',
            suspendedAt: null,
          },
        })
      }

      const otherBlockingDebt = await tx.weeklySettlement.count({
        where: {
          providerId: settlement.providerId,
          id: { not: settlement.id },
          commissionPaid: false,
          OR: [
            { status: { in: ['OVERDUE', 'SUSPENDED'] } },
            { dueAt: { lt: now } },
          ],
        },
      })

      if (otherBlockingDebt === 0) {
        const provider = await tx.user.findUnique({
          where: { id: settlement.providerId },
          select: { suspensionReason: true },
        })

        if (provider?.suspensionReason === 'Weekly commission not paid') {
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

      const confirmedPayment = await tx.commissionPayment.findUniqueOrThrow({
        where: { id: payment.id },
      })
      const updatedSettlement = await tx.weeklySettlement.findUniqueOrThrow({
        where: { id: payment.weeklySettlementId },
      })

      await tx.securityAudit.create({
        data: {
          action: 'COMMISSION_PAYMENT_CONFIRM',
          category: 'FINANCE',
          userId: security.adminId,
          userEmail: security.email,
          userRole: security.role,
          entityType: 'CommissionPayment',
          entityId: payment.id,
          entityName: payment.referenceNumber,
          description: 'CRM confirmed recorded commission payment',
          oldValue: JSON.stringify({
            paymentStatus: payment.status,
            settlementStatus: payment.weeklySettlement.status,
            settlementPaid: payment.weeklySettlement.commissionPaid,
          }),
          newValue: JSON.stringify({
            paymentStatus: confirmedPayment.status,
            settlementStatus: updatedSettlement.status,
            settlementPaid: updatedSettlement.commissionPaid,
            providerId: payment.providerId,
            amountDue: payment.amountDue,
            currency: payment.currency,
            countryCode: payment.countryCode,
            providerReceivableReconciled: receivableReconciliation.featureBacked,
            receivableRecoveredMinor: receivableReconciliation.recoveredMinor.toString(),
            remainingCommissionDueMinor: receivableReconciliation.remainingCommissionDueMinor.toString(),
          }),
          ipAddress: security.ipAddress,
          userAgent: security.userAgent || undefined,
          sessionId: security.sessionId,
          riskLevel: 'HIGH',
          isSuspicious: false,
        },
      })

      return {
        payment: confirmedPayment,
        settlement: updatedSettlement,
        receivableReconciliation: {
          featureBacked: receivableReconciliation.featureBacked,
          recoveredMinor: receivableReconciliation.recoveredMinor.toString(),
          remainingCommissionDueMinor: receivableReconciliation.remainingCommissionDueMinor.toString(),
          providerIdentityId: receivableReconciliation.providerIdentityId,
        },
      }
    })

    return NextResponse.json({
      ...result,
      message: 'Commission payment confirmed and settlement reconciled',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'COMMISSION_PAYMENT_CONCURRENTLY_PROCESSED') {
      return NextResponse.json(
        { error: 'Commission payment was processed concurrently' },
        { status: 409 }
      )
    }
    if (error instanceof Error && error.message === 'SETTLEMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 })
    }

    console.error('CRM commission payment PATCH error:', error)
    return NextResponse.json({ error: 'Failed to confirm commission payment' }, { status: 500 })
  }
}
