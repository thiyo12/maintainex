import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  guardCrmRequest,
  redactCrmSensitiveData,
} from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'
import { evaluateEffectivePermission } from '@/lib/crm/governance'

const RECONCILIATION_STATUSES = new Set(['MATCHED', 'MISMATCH', 'MANUAL_REVIEW'])

function safeJson(value: unknown) {
  return redactCrmSensitiveData(
    JSON.parse(
      JSON.stringify(value, (_key, child) =>
        typeof child === 'bigint' ? child.toString() : child
      )
    )
  )
}

async function scopedPayment(id: string, request: NextRequest, mode: 'read' | 'sensitive') {
  const guard = await guardCrmRequest(request, {
    permission: mode === 'read' ? 'finance:payments:view' : 'finance:payments:reconcile',
    permissionClass: mode === 'read' ? 'READ' : 'SENSITIVE',
    level: mode,
    requireCountryScope: true,
  })
  if (!guard.ok) return { response: guard.response }
  const security = guard.context

  const intent = await prisma.paymentIntent.findUnique({
    where: { id },
    select: {
      id: true,
      jobId: true,
      customerId: true,
      escrowId: true,
      merchantOrderId: true,
      paymentId: true,
      gateway: true,
      refundId: true,
      amount: true,
      currency: true,
      status: true,
      paidAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  if (!intent) return { notFound: true as const }

  const job = await prisma.marketplaceJob.findUnique({
    where: { id: intent.jobId },
    select: {
      id: true,
      title: true,
      status: true,
      countryCode: true,
      customerId: true,
      createdAt: true,
    },
  })
  if (!job) return { notFound: true as const }
  if (!assertCrmCountryAllowed(security, job.countryCode)) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { security, intent, job }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const scoped = await scopedPayment(id, request, 'read')
    if ('response' in scoped && scoped.response) return scoped.response
    if ('notFound' in scoped) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }
    const { security, intent, job } = scoped

    const [
      customer,
      escrow,
      providerTransactions,
      providerRefunds,
      providerEvents,
      settlement,
      payouts,
      dispute,
      approvals,
      audit,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: intent.customerId },
        select: { id: true, mxId: true, name: true, email: true, countryCode: true },
      }),
      prisma.jobEscrow.findUnique({
        where: { id: intent.escrowId },
      }),
      prisma.paymentProviderTransaction.findMany({
        where: { paymentIntentId: intent.id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.paymentProviderRefund.findMany({
        where: { paymentIntentId: intent.id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.paymentProviderEvent.findMany({
        where: { paymentIntentId: intent.id },
        select: {
          id: true,
          provider: true,
          externalEventId: true,
          paymentIntentId: true,
          providerTransactionId: true,
          countryCode: true,
          eventType: true,
          eventStatus: true,
          payloadHash: true,
          signatureVerified: true,
          processingStatus: true,
          errorCode: true,
          errorMessage: true,
          occurredAt: true,
          processedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.commissionSettlement.findMany({
        where: { jobId: intent.jobId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payout.findMany({
        where: { source: 'JOB', sourceId: intent.jobId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.marketplaceDispute.findUnique({
        where: { jobId: intent.jobId },
      }),
      prisma.crmApprovalRequest.findMany({
        where: { targetType: 'PaymentIntent', targetId: intent.id },
        include: {
          decisions: { orderBy: { decidedAt: 'asc' } },
          events: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.securityAudit.findMany({
        where: { entityType: 'PaymentIntent', entityId: intent.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ])

    return NextResponse.json(
      safeJson({
        payment: intent,
        job,
        customer,
        escrow,
        providerTransactions,
        providerRefunds,
        providerEvents,
        settlements: settlement,
        payouts,
        dispute,
        approvals,
        audit,
        actions: {
          reconcile: evaluateEffectivePermission({
            role: security.role,
            permission: 'finance:payments:reconcile',
            permissionClass: 'SENSITIVE',
            overrides: security.permissionOverrides,
          }).allowed,
        },
      }),
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM payment detail GET error:', error)
    return NextResponse.json({ error: 'Failed to load payment detail' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const scoped = await scopedPayment(id, request, 'sensitive')
    if ('response' in scoped && scoped.response) return scoped.response
    if ('notFound' in scoped) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }
    const { security, intent, job } = scoped

    const body = await request.json().catch(() => ({}))
    const transactionId =
      typeof body.transactionId === 'string'
        ? body.transactionId.trim().slice(0, 128)
        : ''
    const reconciliationStatus =
      typeof body.reconciliationStatus === 'string'
        ? body.reconciliationStatus.trim().toUpperCase()
        : ''
    const reference =
      typeof body.reference === 'string'
        ? body.reference.trim().slice(0, 500)
        : ''
    const reason =
      typeof body.reason === 'string'
        ? body.reason.trim().slice(0, 1000)
        : ''

    if (!transactionId || !RECONCILIATION_STATUSES.has(reconciliationStatus)) {
      return NextResponse.json(
        { error: 'A provider transaction and valid reconciliation status are required' },
        { status: 400 }
      )
    }
    if (reference.length < 4 || reason.length < 4) {
      return NextResponse.json(
        { error: 'A reconciliation reference and reason are required' },
        { status: 400 }
      )
    }

    const transaction = await prisma.paymentProviderTransaction.findUnique({
      where: { id: transactionId },
    })
    if (!transaction || transaction.paymentIntentId !== intent.id || transaction.jobId !== job.id) {
      return NextResponse.json({ error: 'Provider transaction not found' }, { status: 404 })
    }
    if (transaction.countryCode !== job.countryCode) {
      return NextResponse.json({ error: 'Provider transaction market mismatch' }, { status: 409 })
    }

    const updated = await prisma.paymentProviderTransaction.update({
      where: { id: transaction.id },
      data: {
        reconciliationStatus,
        reconciliationReference: reference,
        reconciledAt: new Date(),
        metadata: JSON.stringify({
          reconciliationReason: reason,
          reconciledBy: security.adminId,
          reconciledAt: new Date().toISOString(),
        }),
      },
    })

    await createAuditLog({
      action: 'PAYMENT_PROVIDER_RECONCILIATION',
      category: 'FINANCE',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'PaymentIntent',
      entityId: intent.id,
      entityName: intent.merchantOrderId,
      description: 'Provider transaction reconciliation recorded: ' + reason,
      oldValue: {
        transactionId: transaction.id,
        reconciliationStatus: transaction.reconciliationStatus,
        reconciliationReference: transaction.reconciliationReference,
      },
      newValue: {
        transactionId: transaction.id,
        reconciliationStatus,
        reconciliationReference: reference,
        amountMinor: transaction.grossAmount.toString(),
        currency: transaction.currency,
        provider: transaction.provider,
      },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      sessionId: security.sessionId,
      riskLevel: reconciliationStatus === 'MATCHED' ? 'MEDIUM' : 'HIGH',
    })

    return NextResponse.json(
      {
        success: true,
        transaction: safeJson(updated),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM payment reconciliation PATCH error:', error)
    return NextResponse.json({ error: 'Failed to reconcile provider transaction' }, { status: 500 })
  }
}
