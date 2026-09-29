import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/authentication/admin-auth'
import { getCountryFilter } from '@/lib/auth/authorization/admin-rbac'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'FINANCE']

// GET: List payout withdrawal requests with stats for admin approval workflow.
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const skip = (page - 1) * limit

    const countryFilter = getCountryFilter(session)

    const where: Record<string, unknown> = { ...countryFilter }
    if (status && status !== 'ALL') {
      where.status = status
    }

    const payouts = await prisma.payout.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })

    const total = await prisma.payout.count({ where })

    const userIds = [...new Set(payouts.map(p => p.userId))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, mxId: true },
    })
    const userMap = new Map(users.map(u => [u.id, u]))

    const stats = await prisma.payout.groupBy({
      by: ['status'],
      where: countryFilter as never,
      _count: { _all: true },
      _sum: { amount: true },
    })

    return NextResponse.json({
      payouts: payouts.map(p => ({
        ...p,
        amount: p.amount.toString(),
        provider: userMap.get(p.userId) || null,
      })),
      total,
      page,
      limit,
      stats: stats.map(s => ({
        status: s.status,
        count: s._count._all,
        amount: s._sum.amount?.toString() ?? '0',
      })),
    })
  } catch (error) {
    console.error('Payout list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
