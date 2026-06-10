import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [totalUsers, activeJobs, openDisputes, pendingKyc, totalEscrows, recentActivity] =
      await Promise.all([
        prisma.user.count({ where: { isActive: true } }),
        prisma.marketplaceJob.count({
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        }),
        prisma.dispute.count({ where: { status: 'OPEN' } }),
        prisma.identityDocument.count({ where: { status: 'PENDING' } }),
        prisma.jobEscrow.count(),
        prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            adminEmail: true,
            action: true,
            targetLabel: true,
            createdAt: true,
          },
        }),
      ])

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeJobs,
          monthlyRevenue: 0,
          openDisputes,
          pendingKyc,
          totalEscrows,
        },
        recentActivity: recentActivity.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        })),
      },
    })
  } catch (error) {
    console.error('Summary error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch summary' },
      { status: 500 },
    )
  }
}
