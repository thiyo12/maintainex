import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCrmCountryFilter, guardCrmRequest } from '@/lib/crm/security'

type MoneyGroup = {
  status: string
  count: bigint
  total: bigint | null
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

    const countryFilter = getCrmCountryFilter(security)
    const countryWhere = security.isSuperAdmin
      ? Prisma.empty
      : Prisma.sql`WHERE j."countryCode" IN (${Prisma.join(security.assignedCountries)})`

    const [
      settlementsByStatus,
      payoutsByStatus,
      escrowRows,
      paymentRows,
      recentSettlements,
      recentPayouts,
    ] = await Promise.all([
      prisma.commissionSettlement.groupBy({
        by: ['status'],
        where: countryFilter,
        _count: true,
        _sum: {
          jobAmount: true,
          commissionAmount: true,
        },
      }),
      prisma.payout.groupBy({
        by: ['status'],
        where: countryFilter,
        _count: true,
        _sum: { amount: true },
      }),
      prisma.$queryRaw<MoneyGroup[]>(Prisma.sql`
        SELECT
          e.status,
          COUNT(*)::bigint AS count,
          COALESCE(SUM(e."totalAmount"), 0)::bigint AS total
        FROM "JobEscrow" e
        JOIN "MarketplaceJob" j ON j.id = e."jobId"
        ${countryWhere}
        GROUP BY e.status
        ORDER BY e.status
      `),
      prisma.$queryRaw<MoneyGroup[]>(Prisma.sql`
        SELECT
          p.status,
          COUNT(*)::bigint AS count,
          COALESCE(SUM(p.amount), 0)::bigint AS total
        FROM "PaymentIntent" p
        JOIN "MarketplaceJob" j ON j.id = p."jobId"
        ${countryWhere}
        GROUP BY p.status
        ORDER BY p.status
      `),
      prisma.commissionSettlement.findMany({
        where: countryFilter,
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      prisma.payout.findMany({
        where: countryFilter,
        select: {
          id: true,
          userId: true,
          amount: true,
          description: true,
          status: true,
          source: true,
          sourceId: true,
          method: true,
          currency: true,
          countryCode: true,
          createdAt: true,
          clearedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
    ])

    const userIds = [...new Set(recentPayouts.map(payout => payout.userId))]
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, mxId: true, name: true, role: true },
        })
      : []
    const userMap = new Map(users.map(user => [user.id, user]))

    function serialiseGroup(rows: MoneyGroup[]) {
      return rows.map(row => ({
        status: row.status,
        count: Number(row.count),
        total: (row.total || BigInt(0)).toString(),
      }))
    }

    return NextResponse.json(
      {
        commission: settlementsByStatus.map(row => ({
          status: row.status,
          count: row._count,
          jobAmount: (row._sum.jobAmount || BigInt(0)).toString(),
          commissionAmount: (row._sum.commissionAmount || BigInt(0)).toString(),
        })),
        payouts: payoutsByStatus.map(row => ({
          status: row.status,
          count: row._count,
          amount: (row._sum.amount || BigInt(0)).toString(),
        })),
        escrow: serialiseGroup(escrowRows),
        payments: serialiseGroup(paymentRows),
        recentSettlements: recentSettlements.map(row => ({
          ...row,
          jobAmount: row.jobAmount.toString(),
          commissionAmount: row.commissionAmount.toString(),
        })),
        recentPayouts: recentPayouts.map(row => ({
          ...row,
          amount: row.amount.toString(),
          user: userMap.get(row.userId) || null,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM finance overview GET error:', error)
    return NextResponse.json({ error: 'Failed to load finance overview' }, { status: 500 })
  }
}
