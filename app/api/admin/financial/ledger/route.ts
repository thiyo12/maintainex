import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'

const VALID_ENTRY_TYPES = new Set(['ALL', 'DEBIT', 'CREDIT'])

type LedgerRow = {
  id: string
  groupId: string | null
  accountId: string
  accountType: string
  entryType: string
  amount: bigint
  currency: string
  referenceType: string
  referenceId: string
  description: string | null
  createdBy: string
  createdAt: Date
  countryCode: string | null
}

type LedgerStatRow = {
  currency: string
  entryType: string
  count: bigint
  total: bigint
}

type CountRow = { count: bigint }

function scopeCte() {
  return Prisma.sql`
    WITH base AS (
      SELECT
        l.id,
        l."groupId",
        l."accountId",
        l."accountType",
        l."entryType",
        l.amount,
        l.currency,
        l."referenceType",
        l."referenceId",
        l.description,
        l."createdBy",
        l."createdAt",
        CASE
          WHEN l."referenceType" IN (
            'ESCROW_DEPOSIT',
            'ESCROW_RELEASE',
            'ESCROW_REFUND',
            'ESCROW_EXTERNAL_REFUND'
          ) THEN ej."countryCode"
          WHEN l."referenceType" IN (
            'PAYMENT_REFUND_SUSPENSE',
            'PAYMENT_EXTERNAL_REFUND'
          ) THEN pj."countryCode"
          WHEN l."referenceType" IN (
            'WITHDRAWAL_RESERVED',
            'PAYOUT_SUCCEEDED',
            'WITHDRAWAL_RELEASED'
          ) THEN po."countryCode"
          ELSE NULL
        END AS "directCountry"
      FROM "FinancialLedger" l
      LEFT JOIN "JobEscrow" e
        ON l."referenceType" IN (
          'ESCROW_DEPOSIT',
          'ESCROW_RELEASE',
          'ESCROW_REFUND',
          'ESCROW_EXTERNAL_REFUND'
        )
       AND e.id = l."referenceId"
      LEFT JOIN "MarketplaceJob" ej ON ej.id = e."jobId"
      LEFT JOIN "PaymentIntent" pi
        ON l."referenceType" IN (
          'PAYMENT_REFUND_SUSPENSE',
          'PAYMENT_EXTERNAL_REFUND'
        )
       AND pi.id = l."referenceId"
      LEFT JOIN "MarketplaceJob" pj ON pj.id = pi."jobId"
      LEFT JOIN "Payout" po
        ON l."referenceType" IN (
          'WITHDRAWAL_RESERVED',
          'PAYOUT_SUCCEEDED',
          'WITHDRAWAL_RELEASED'
        )
       AND po.id = l."referenceId"
    ),
    resolved AS (
      SELECT
        b.*,
        COALESCE(b."directCountry", reversal_origin."directCountry") AS "countryCode"
      FROM base b
      LEFT JOIN LATERAL (
        SELECT origin."directCountry"
        FROM base origin
        WHERE b."referenceType" = 'REVERSAL'
          AND origin."groupId" = b."referenceId"
          AND origin."directCountry" IS NOT NULL
        ORDER BY origin."createdAt" ASC
        LIMIT 1
      ) reversal_origin ON true
    )
  `
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'finance:ledger:view',
      permissionClass: 'READ',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50))
    const offset = (page - 1) * limit
    const entryType = (searchParams.get('entryType') || 'ALL').trim().toUpperCase()
    const currency = (searchParams.get('currency') || 'ALL').trim().toUpperCase()
    const referenceType = (searchParams.get('referenceType') || '').trim().toUpperCase()

    if (!VALID_ENTRY_TYPES.has(entryType)) {
      return NextResponse.json({ error: 'Invalid ledger entry type' }, { status: 400 })
    }
    if (currency !== 'ALL' && !/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 })
    }
    if (referenceType && !/^[A-Z0-9_]{1,80}$/.test(referenceType)) {
      return NextResponse.json({ error: 'Invalid reference type' }, { status: 400 })
    }

    const countryClause = security.isSuperAdmin
      ? Prisma.empty
      : Prisma.sql`AND "countryCode" IN (${Prisma.join(security.assignedCountries)})`
    const entryClause = entryType === 'ALL'
      ? Prisma.empty
      : Prisma.sql`AND "entryType" = ${entryType}`
    const currencyClause = currency === 'ALL'
      ? Prisma.empty
      : Prisma.sql`AND currency = ${currency}`
    const referenceClause = referenceType
      ? Prisma.sql`AND "referenceType" = ${referenceType}`
      : Prisma.empty

    const cte = scopeCte()

    const [rows, counts, stats] = await Promise.all([
      prisma.$queryRaw<LedgerRow[]>(Prisma.sql`
        ${cte}
        SELECT
          id,
          "groupId",
          "accountId",
          "accountType",
          "entryType",
          amount,
          currency,
          "referenceType",
          "referenceId",
          description,
          "createdBy",
          "createdAt",
          "countryCode"
        FROM resolved
        WHERE 1 = 1
          ${countryClause}
          ${entryClause}
          ${currencyClause}
          ${referenceClause}
        ORDER BY "createdAt" DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `),
      prisma.$queryRaw<CountRow[]>(Prisma.sql`
        ${cte}
        SELECT COUNT(*)::bigint AS count
        FROM resolved
        WHERE 1 = 1
          ${countryClause}
          ${entryClause}
          ${currencyClause}
          ${referenceClause}
      `),
      prisma.$queryRaw<LedgerStatRow[]>(Prisma.sql`
        ${cte}
        SELECT
          currency,
          "entryType",
          COUNT(*)::bigint AS count,
          COALESCE(SUM(amount), 0)::bigint AS total
        FROM resolved
        WHERE 1 = 1
          ${countryClause}
        GROUP BY currency, "entryType"
        ORDER BY currency, "entryType"
      `),
    ])

    const total = Number(counts[0]?.count || 0n)

    return NextResponse.json(
      {
        entries: rows.map(row => ({
          ...row,
          amount: row.amount.toString(),
        })),
        stats: stats.map(row => ({
          currency: row.currency,
          entryType: row.entryType,
          count: Number(row.count),
          total: row.total.toString(),
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
        scope: {
          markets: security.isSuperAdmin ? ['*'] : security.assignedCountries,
          unknownReferencesVisible: security.isSuperAdmin,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM financial ledger GET error:', error)
    return NextResponse.json({ error: 'Failed to load financial ledger' }, { status: 500 })
  }
}
