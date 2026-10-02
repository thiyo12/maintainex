import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCrmCountryCodes, guardCrmRequest } from '@/lib/crm/security'
import { evaluateActionInitiation } from '@/lib/crm/governance'

const VALID_PROVIDERS = new Set(['ALL', 'PAYPAL', 'PAYHERE', 'MANUAL_BANK'])

const VALID_STATUSES = new Set([
  'ALL',
  'CREATED',
  'PENDING',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'REFUND_REQUIRED',
  'REFUND_PROCESSING',
  'REFUNDED',
  'CHARGEDBACK',
])

type PaymentRow = {
  id: string
  jobId: string
  customerId: string
  escrowId: string
  merchantOrderId: string
  paymentId: string | null
  gateway: string
  amount: bigint
  currency: string
  status: string
  createdAt: Date
  updatedAt: Date
  paidAt: Date | null
  jobTitle: string
  countryCode: string
  jobStatus: string
  escrowStatus: string | null
  paymentMethod: string | null
  disputeStatus: string | null
  providerTransactionId: string | null
  providerOrderId: string | null
  providerCaptureId: string | null
  providerTransactionStatus: string | null
  providerFee: bigint | null
  netSettlement: bigint | null
  reconciliationStatus: string | null
  reconciliationReference: string | null
  reconciledAt: Date | null
  providerEventCount: bigint
  providerFailedEventCount: bigint
}

type PaymentStatRow = {
  status: string
  currency: string
  count: bigint
  total: bigint
}

type CountRow = { count: bigint }

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'finance:payments:view',
      permissionClass: 'READ',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || 'ALL').trim().toUpperCase()
    const provider = (searchParams.get('provider') || 'ALL').trim().toUpperCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10) || 30))
    const offset = (page - 1) * limit

    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 })
    }
    if (!VALID_PROVIDERS.has(provider)) {
      return NextResponse.json({ error: 'Invalid payment provider' }, { status: 400 })
    }

    const scopedCountryCodes = getCrmCountryCodes(security)
    const countryClause = scopedCountryCodes === null
      ? Prisma.empty
      : scopedCountryCodes.length === 0
        ? Prisma.sql`AND 1 = 0`
        : Prisma.sql`AND j."countryCode" IN (${Prisma.join(scopedCountryCodes)})`
    const statusClause = status === 'ALL'
      ? Prisma.empty
      : Prisma.sql`AND p.status = ${status}`
    const providerClause = provider === 'ALL'
      ? Prisma.empty
      : Prisma.sql`AND p.gateway = ${provider}`

    const [rows, countRows, stats] = await Promise.all([
      prisma.$queryRaw<PaymentRow[]>(Prisma.sql`
        SELECT
          p.id,
          p."jobId",
          p."customerId",
          p."escrowId",
          p."merchantOrderId",
          p."paymentId",
          p.gateway,
          p.amount,
          p.currency,
          p.status,
          p."createdAt",
          p."updatedAt",
          p."paidAt",
          j.title AS "jobTitle",
          j."countryCode",
          j.status AS "jobStatus",
          e.status AS "escrowStatus",
          e."paymentMethod",
          d.status AS "disputeStatus",
          pt.id AS "providerTransactionId",
          pt."providerOrderId",
          pt."providerCaptureId",
          pt.status AS "providerTransactionStatus",
          pt."providerFee",
          pt."netSettlement",
          pt."reconciliationStatus",
          pt."reconciliationReference",
          pt."reconciledAt",
          COALESCE(pe."eventCount", 0)::bigint AS "providerEventCount",
          COALESCE(pe."failedEventCount", 0)::bigint AS "providerFailedEventCount"
        FROM "PaymentIntent" p
        JOIN "MarketplaceJob" j ON j.id = p."jobId"
        LEFT JOIN "JobEscrow" e ON e.id = p."escrowId"
        LEFT JOIN "MarketplaceDispute" d ON d."jobId" = j.id
        LEFT JOIN LATERAL (
          SELECT t.*
          FROM "PaymentProviderTransaction" t
          WHERE t."paymentIntentId" = p.id
          ORDER BY t."createdAt" DESC
          LIMIT 1
        ) pt ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::bigint AS "eventCount",
            COUNT(*) FILTER (WHERE ev."processingStatus" = 'FAILED')::bigint AS "failedEventCount"
          FROM "PaymentProviderEvent" ev
          WHERE ev."paymentIntentId" = p.id
        ) pe ON TRUE
        WHERE 1 = 1
          ${countryClause}
          ${statusClause}
          ${providerClause}
        ORDER BY p."updatedAt" DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `),
      prisma.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM "PaymentIntent" p
        JOIN "MarketplaceJob" j ON j.id = p."jobId"
        WHERE 1 = 1
          ${countryClause}
          ${statusClause}
          ${providerClause}
      `),
      prisma.$queryRaw<PaymentStatRow[]>(Prisma.sql`
        SELECT
          p.status,
          p.currency,
          COUNT(*)::bigint AS count,
          COALESCE(SUM(p.amount), 0)::bigint AS total
        FROM "PaymentIntent" p
        JOIN "MarketplaceJob" j ON j.id = p."jobId"
        WHERE 1 = 1
          ${countryClause}
          ${providerClause}
        GROUP BY p.status, p.currency
        ORDER BY p.currency, p.status
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
        payments: rows.map(row => ({
          ...row,
          amount: row.amount.toString(),
          providerFee: row.providerFee?.toString() || null,
          netSettlement: row.netSettlement?.toString() || null,
          providerEventCount: Number(row.providerEventCount || 0n),
          providerFailedEventCount: Number(row.providerFailedEventCount || 0n),
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
        providers: [...new Set(rows.map(row => row.gateway))].sort(),
        actions: {
          refund: evaluateActionInitiation({
            role: security.role,
            actionId: 'finance.refund',
            overrides: security.permissionOverrides,
          }).allowed,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM payment operations GET error:', error)
    return NextResponse.json({ error: 'Failed to load payment operations' }, { status: 500 })
  }
}
