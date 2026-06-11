import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, getIp } from '@/lib/admin-rbac'

export async function GET(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const [totalUsers, activeJobs, openDisputes, pendingKyc, totalEscrows] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.marketplaceJob.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, isActive: true },
      }),
      prisma.dispute.count({ where: { status: 'OPEN' } }),
      prisma.identityDocument.count({ where: { status: 'PENDING' } }),
      prisma.jobEscrow.count(),
    ])

    const monthlyRevenueAgg = await prisma.jobEscrow.aggregate({
      _sum: { amount: true },
      where: {
        status: 'RELEASED',
        releasedAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        totalUsers,
        activeJobs,
        monthlyRevenueCents: Number(monthlyRevenueAgg._sum.amount ?? 0),
        openDisputes,
        pendingKyc,
        totalEscrows,
      },
    })
  } catch (e) {
    console.error('Reports summary error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch summary' }, { status: 500 })
  }
}
