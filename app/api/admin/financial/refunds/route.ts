import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryFilter,
  guardCrmRequest,
  type CrmSecurityContext,
} from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'
import {
  reconcilePayHereRefund,
  requestRequiredPayHereRefund,
} from '@/lib/finance/payments/payment-service'

const REFUND_STATUSES = ['REFUND_REQUIRED', 'REFUND_PROCESSING', 'REFUNDED'] as const

async function scopedJobIds(security: CrmSecurityContext) {
  if (security.isSuperAdmin) return null
  return (await prisma.marketplaceJob.findMany({
    where: getCrmCountryFilter(security),
    select: { id: true },
  })).map(job => job.id)
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'wallets:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || '').trim().toUpperCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10) || 30))

    if (status && !REFUND_STATUSES.includes(status as (typeof REFUND_STATUSES)[number])) {
      return NextResponse.json({ error: 'Invalid refund status' }, { status: 400 })
    }

    const jobIds = await scopedJobIds(security)
    const where: any = {
      status: status || { in: [...REFUND_STATUSES] },
    }
    if (jobIds) where.jobId = { in: jobIds }

    const [intents, total] = await Promise.all([
      prisma.paymentIntent.findMany({
        where,
        select: {
          id: true,
          jobId: true,
          customerId: true,
          escrowId: true,
          merchantOrderId: true,
          paymentId: true,
          amount: true,
          currency: true,
          status: true,
          paidAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.paymentIntent.count({ where }),
    ])

    const [jobs, customers] = await Promise.all([
      intents.length
        ? prisma.marketplaceJob.findMany({
            where: { id: { in: [...new Set(intents.map(item => item.jobId))] } },
            select: { id: true, title: true, countryCode: true, status: true },
          })
        : [],
      intents.length
        ? prisma.user.findMany({
            where: { id: { in: [...new Set(intents.map(item => item.customerId))] } },
            select: { id: true, mxId: true, name: true, email: true },
          })
        : [],
    ])

    const jobMap = new Map(jobs.map(job => [job.id, job]))
    const customerMap = new Map(customers.map(customer => [customer.id, customer]))

    return NextResponse.json(
      {
        refunds: intents.map(intent => ({
          ...intent,
          amount: intent.amount.toString(),
          job: jobMap.get(intent.jobId) || null,
          customer: customerMap.get(intent.customerId) || null,
        })),
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
    console.error('CRM refund queue GET error:', error)
    return NextResponse.json({ error: 'Failed to load refund queue' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'wallets:manage',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const rateLimit = await requireFinancialRateLimit(request, 'payhere-refund-admin')
    if (rateLimit) return rateLimit

    const body = await request.json().catch(() => ({}))
    const paymentIntentId = typeof body?.paymentIntentId === 'string'
      ? body.paymentIntentId.trim().slice(0, 128)
      : ''
    const action = typeof body?.action === 'string' ? body.action.trim().toUpperCase() : ''

    if (!paymentIntentId || !['RETRY', 'RECONCILE'].includes(action)) {
      return NextResponse.json(
        { error: 'paymentIntentId and action RETRY or RECONCILE are required' },
        { status: 400 }
      )
    }

    const intent = await prisma.paymentIntent.findUnique({
      where: { id: paymentIntentId },
      select: {
        id: true,
        jobId: true,
        status: true,
        merchantOrderId: true,
        paymentId: true,
      },
    })
    if (!intent) return NextResponse.json({ error: 'Payment intent not found' }, { status: 404 })

    const job = await prisma.marketplaceJob.findUnique({
      where: { id: intent.jobId },
      select: { id: true, title: true, countryCode: true },
    })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (!assertCrmCountryAllowed(security, job.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = action === 'RETRY'
      ? await requestRequiredPayHereRefund(intent.id)
      : await reconcilePayHereRefund(intent.id)

    await createAuditLog({
      action: 'UPDATE',
      category: 'FINANCE',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'PaymentIntent',
      entityId: intent.id,
      entityName: intent.merchantOrderId,
      description: `CRM PayHere refund ${action.toLowerCase()}`,
      oldValue: { status: intent.status },
      newValue: {
        status: result.status,
        success: result.success,
        code: result.code || null,
        paymentIdPresent: Boolean(intent.paymentId),
      },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: result.success ? 'MEDIUM' : 'HIGH',
    })

    return NextResponse.json(
      {
        result: {
          success: result.success,
          status: result.status,
          code: result.code || null,
          error: result.error || null,
          refundReference: result.refundReference || null,
        },
      },
      { status: result.success ? 200 : 409 }
    )
  } catch (error) {
    console.error('CRM refund queue PATCH error:', error)
    return NextResponse.json({ error: 'Failed to process refund action' }, { status: 500 })
  }
}
