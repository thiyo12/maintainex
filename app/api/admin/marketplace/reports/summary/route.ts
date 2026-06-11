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
    const [jobCustomers, quoteProviders, activeJobs, pendingKyc, totalEscrows] = await Promise.all([
      prisma.marketplaceJob.findMany({
        where: { isActive: true },
        select: { customerId: true },
        distinct: ['customerId'],
      }),
      prisma.jobQuote.findMany({
        where: { status: { not: 'WITHDRAWN' } },
        select: { providerId: true },
        distinct: ['providerId'],
      }),
      prisma.marketplaceJob.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, isActive: true },
      }),
      prisma.identityDocument.count({ where: { status: 'PENDING' } }),
      prisma.jobEscrow.count(),
    ])

    const uniqueUserIds = Array.from(new Set([
      ...jobCustomers.map((j) => j.customerId),
      ...quoteProviders.map((j) => j.providerId),
    ]))

    const marketplaceUsers = uniqueUserIds.length > 0
      ? await prisma.user.count({ where: { id: { in: uniqueUserIds }, isActive: true } })
      : 0

    const monthlyRevenueAgg = await prisma.jobEscrow.aggregate({
      _sum: { amount: true },
      where: {
        status: 'RELEASED',
        releasedAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    })

    const recentActivity = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        adminEmail: true,
        action: true,
        targetLabel: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        totalUsers: marketplaceUsers,
        activeJobs,
        monthlyRevenue: Number(monthlyRevenueAgg._sum.amount ?? 0),
        pendingKyc,
        totalEscrows,
        recentActivity: recentActivity.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        })),
      },
    })
  } catch (e) {
    console.error('Reports summary error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch summary' }, { status: 500 })
  }
}
