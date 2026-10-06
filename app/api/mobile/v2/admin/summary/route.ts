import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCrmCountryFilter, guardCrmRequest } from '@/lib/crm/security'

type CountRow = { count: bigint }
type EscrowSummaryRow = {
  total: bigint
  held: bigint
  released: bigint
  refunded: bigint
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'dashboard:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const jobWhere = getCrmCountryFilter(security)
    const jobCountryWhere = security.isSuperAdmin
      ? Prisma.empty
      : Prisma.sql`WHERE j."countryCode" IN (${Prisma.join(security.assignedCountries)})`
    const userCountryWhere = security.isSuperAdmin
      ? Prisma.empty
      : Prisma.sql`WHERE u."countryCode" IN (${Prisma.join(security.assignedCountries)})`

    const [
      totalJobs,
      openJobs,
      inProgressJobs,
      completedJobs,
      cancelledJobs,
      escrowRows,
      quoteRows,
      customerRows,
      providerRows,
    ] = await Promise.all([
      prisma.marketplaceJob.count({ where: jobWhere }),
      prisma.marketplaceJob.count({ where: { ...jobWhere, status: 'OPEN' } }),
      prisma.marketplaceJob.count({ where: { ...jobWhere, status: 'IN_PROGRESS' } }),
      prisma.marketplaceJob.count({ where: { ...jobWhere, status: 'COMPLETED' } }),
      prisma.marketplaceJob.count({ where: { ...jobWhere, status: 'CANCELLED' } }),
      prisma.$queryRaw<EscrowSummaryRow[]>(Prisma.sql`
        SELECT
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE e.status = 'PROTECTED')::bigint AS held,
          COUNT(*) FILTER (WHERE e.status = 'RELEASED')::bigint AS released,
          COUNT(*) FILTER (WHERE e.status = 'REFUNDED')::bigint AS refunded
        FROM "JobEscrow" e
        JOIN "MarketplaceJob" j ON j.id = e."jobId"
        ${jobCountryWhere}
      `),
      prisma.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM "JobQuote" q
        JOIN "MarketplaceJob" j ON j.id = q."jobId"
        ${jobCountryWhere}
      `),
      prisma.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM "CustomerWallet" w
        JOIN "User" u ON u.id = w."userId"
        ${userCountryWhere}
      `),
      prisma.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM "ProviderWallet" w
        JOIN "User" u ON u.id = w."userId"
        ${userCountryWhere}
      `),
    ])

    const escrow = escrowRows[0] || {
      total: 0n,
      held: 0n,
      released: 0n,
      refunded: 0n,
    }

    return NextResponse.json(
      {
        summary: {
          jobs: {
            total: totalJobs,
            open: openJobs,
            inProgress: inProgressJobs,
            completed: completedJobs,
            cancelled: cancelledJobs,
          },
          escrows: {
            total: Number(escrow.total),
            held: Number(escrow.held),
            released: Number(escrow.released),
            refunded: Number(escrow.refunded),
          },
          quotes: Number(quoteRows[0]?.count || 0n),
          customers: Number(customerRows[0]?.count || 0n),
          providers: Number(providerRows[0]?.count || 0n),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    secureConsole.error('Admin summary error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
