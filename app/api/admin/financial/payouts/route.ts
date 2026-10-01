import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCrmCountryFilter, guardCrmRequest } from '@/lib/crm/security'

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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const skip = (page - 1) * limit

    const countryFilter = getCrmCountryFilter(security)
    const where: any = { ...countryFilter }
    if (status && status !== 'ALL') where.status = status

    const [payouts, total, stats] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payout.count({ where }),
      prisma.payout.groupBy({
        by: ['status'],
        where: countryFilter,
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ])

    const userIds = [...new Set(payouts.map(payout => payout.userId))]
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, mxId: true },
        })
      : []
    const userMap = new Map(users.map(user => [user.id, user]))

    return NextResponse.json(
      {
        payouts: payouts.map(payout => ({
          ...payout,
          amount: payout.amount.toString(),
          bankDetails: payout.bankDetails ? '[REDACTED]' : null,
          provider: userMap.get(payout.userId) || null,
        })),
        total,
        page,
        limit,
        stats: stats.map(row => ({
          status: row.status,
          count: row._count._all,
          amount: row._sum.amount?.toString() ?? '0',
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM payout list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
