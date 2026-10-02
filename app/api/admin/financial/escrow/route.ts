import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryCodes,
  guardCrmAction,
  guardCrmRequest,
} from '@/lib/crm/security'
import {
  CrmApprovalError,
  createCrmApprovalRequest,
  evaluateActionInitiation,
} from '@/lib/crm/governance'
import { resolveCurrentApprovalRisk } from '@/lib/crm/governance/current-risk'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'

const VALID_STATUSES = new Set([
  'ALL',
  'PENDING',
  'PENDING_PAYMENT',
  'PROTECTED',
  'ON_HOLD',
  'RELEASED',
  'REFUNDED',
  'CANCELLED',
  'CASH_CONFIRMED',
])

type EscrowRow = {
  id: string
  jobId: string
  quoteId: string
  customerId: string
  providerId: string
  amount: bigint
  serviceFee: bigint
  totalAmount: bigint
  paymentMethod: string
  currency: string
  status: string
  heldAt: Date | null
  releasedAt: Date | null
  refundedAt: Date | null
  cashConfirmedAt: Date | null
  createdAt: Date
  updatedAt: Date
  jobTitle: string
  countryCode: string
  jobStatus: string
  disputeStatus: string | null
  resolutionAction: string | null
}

type EscrowStatRow = {
  status: string
  currency: string
  count: bigint
  total: bigint
}

type CountRow = { count: bigint }

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'finance:escrow:view',
      permissionClass: 'READ',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || 'ALL').trim().toUpperCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10) || 30))
    const offset = (page - 1) * limit

    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid escrow status' }, { status: 400 })
    }

    const scopedCountryCodes = getCrmCountryCodes(security)
    const countryClause = scopedCountryCodes === null
      ? Prisma.empty
      : scopedCountryCodes.length === 0
        ? Prisma.sql`AND 1 = 0`
        : Prisma.sql`AND j."countryCode" IN (${Prisma.join(scopedCountryCodes)})`
    const statusClause = status === 'ALL'
      ? Prisma.empty
      : Prisma.sql`AND e.status = ${status}`

    const [rows, countRows, stats] = await Promise.all([
      prisma.$queryRaw<EscrowRow[]>(Prisma.sql`
        SELECT
          e.id,
          e."jobId",
          e."quoteId",
          e."customerId",
          e."providerId",
          e.amount,
          e."serviceFee",
          e."totalAmount",
          e."paymentMethod",
          e.currency,
          e.status,
          e."heldAt",
          e."releasedAt",
          e."refundedAt",
          e."cashConfirmedAt",
          e."createdAt",
          e."updatedAt",
          j.title AS "jobTitle",
          j."countryCode",
          j.status AS "jobStatus",
          d.status AS "disputeStatus",
          d."resolutionAction"
        FROM "JobEscrow" e
        JOIN "MarketplaceJob" j ON j.id = e."jobId"
        LEFT JOIN "MarketplaceDispute" d ON d."jobId" = j.id
        WHERE 1 = 1
          ${countryClause}
          ${statusClause}
        ORDER BY e."updatedAt" DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `),
      prisma.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM "JobEscrow" e
        JOIN "MarketplaceJob" j ON j.id = e."jobId"
        WHERE 1 = 1
          ${countryClause}
          ${statusClause}
      `),
      prisma.$queryRaw<EscrowStatRow[]>(Prisma.sql`
        SELECT
          e.status,
          e.currency,
          COUNT(*)::bigint AS count,
          COALESCE(SUM(e."totalAmount"), 0)::bigint AS total
        FROM "JobEscrow" e
        JOIN "MarketplaceJob" j ON j.id = e."jobId"
        WHERE 1 = 1
          ${countryClause}
        GROUP BY e.status, e.currency
        ORDER BY e.currency, e.status
      `),
    ])

    const customerIds = [...new Set(rows.map(row => row.customerId))]
    const customers = customerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, mxId: true, name: true, email: true },
        })
      : []
    const customerMap = new Map(customers.map(customer => [customer.id, customer]))

    const total = Number(countRows[0]?.count || 0n)

    return NextResponse.json(
      {
        escrows: rows.map(row => ({
          ...row,
          amount: row.amount.toString(),
          serviceFee: row.serviceFee.toString(),
          totalAmount: row.totalAmount.toString(),
          customer: customerMap.get(row.customerId) || null,
        })),
        stats: stats.map(row => ({
          status: row.status,
          currency: row.currency,
          count: Number(row.count),
          total: row.total.toString(),
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
        actions: {
          manualRelease: evaluateActionInitiation({
            role: security.role,
            actionId: 'finance.escrow.manual_release',
            overrides: security.permissionOverrides,
          }).allowed,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM escrow queue GET error:', error)
    return NextResponse.json({ error: 'Failed to load escrow queue' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmAction(request, 'finance.escrow.manual_release')
    if (!guard.ok) return guard.response
    const security = guard.context

    const rateLimit = await requireFinancialRateLimit(request, 'crm-escrow-release')
    if (rateLimit) return rateLimit

    const body = await request.json().catch(() => ({}))
    const escrowId = typeof body?.escrowId === 'string'
      ? body.escrowId.trim().slice(0, 128)
      : ''
    const reason = typeof body?.reason === 'string'
      ? body.reason.trim().slice(0, 1000)
      : ''
    const idempotencyKey = typeof body?.idempotencyKey === 'string'
      ? body.idempotencyKey.trim().slice(0, 200)
      : ''

    if (!escrowId || reason.length < 8 || idempotencyKey.length < 8) {
      return NextResponse.json(
        { error: 'escrowId, a clear reason, and idempotencyKey are required' },
        { status: 400 }
      )
    }

    const escrow = await prisma.jobEscrow.findUnique({
      where: { id: escrowId },
      select: {
        id: true,
        jobId: true,
        status: true,
        paymentMethod: true,
        totalAmount: true,
        currency: true,
      },
    })
    if (!escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    const [job, dispute] = await Promise.all([
      prisma.marketplaceJob.findUnique({
        where: { id: escrow.jobId },
        select: { id: true, title: true, countryCode: true, status: true },
      }),
      prisma.marketplaceDispute.findUnique({
        where: { jobId: escrow.jobId },
        select: { status: true, resolutionAction: true },
      }),
    ])
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (!assertCrmCountryAllowed(security, job.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!['PROTECTED', 'ON_HOLD'].includes(escrow.status)) {
      return NextResponse.json(
        { error: `Escrow cannot be manually released from ${escrow.status}` },
        { status: 409 }
      )
    }
    if (escrow.paymentMethod === 'CASH') {
      return NextResponse.json(
        { error: 'Cash escrow cannot be released through funded escrow controls' },
        { status: 409 }
      )
    }

    const disputeAllowsProviderRelease = Boolean(
      dispute &&
      ['RESOLVING', 'RESOLVED'].includes(dispute.status) &&
      dispute.resolutionAction === 'RELEASE_PROVIDER'
    )
    if (job.status !== 'COMPLETED' && !disputeAllowsProviderRelease) {
      return NextResponse.json(
        { error: 'Job must be completed, or an authorized dispute resolution must release the provider.' },
        { status: 409 }
      )
    }

    const currentRisk = await resolveCurrentApprovalRisk({
      actionId: 'finance.escrow.manual_release',
      market: job.countryCode,
      targetType: 'JobEscrow',
      targetId: escrow.id,
      amountMinor: escrow.totalAmount,
      currency: escrow.currency,
    })

    const approval = await createCrmApprovalRequest({
      actionId: 'finance.escrow.manual_release',
      initiatorAdminId: security.adminId,
      market: job.countryCode,
      targetType: 'JobEscrow',
      targetId: escrow.id,
      amountMinor: escrow.totalAmount,
      currency: escrow.currency,
      reasonCode: 'MANUAL_ESCROW_RELEASE',
      note: reason,
      idempotencyKey,
      risk: currentRisk.risk,
    })

    return NextResponse.json(
      {
        mode: 'APPROVAL_REQUIRED',
        approval: {
          id: approval.request.id,
          status: approval.request.status,
          tier: approval.request.tier,
          expiresAt: approval.request.expiresAt,
          reused: approval.reused,
        },
      },
      { status: 202 }
    )
  } catch (error) {
    if (error instanceof CrmApprovalError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      )
    }
    console.error('CRM escrow queue PATCH error:', error)
    return NextResponse.json({ error: 'Failed to process escrow action' }, { status: 500 })
  }
}
