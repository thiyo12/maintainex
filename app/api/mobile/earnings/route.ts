import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payouts = await prisma.payout.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    const totalEarned = payouts
      .filter(p => p.status === 'CLEARED')
      .reduce((sum, p) => sum + Number(p.amount), 0) / 100
    const pendingAmount = payouts
      .filter(p => p.status === 'PENDING')
      .reduce((sum, p) => sum + Number(p.amount), 0) / 100

    const completedJobs = await prisma.jobPosting.count({
      where: {
        status: 'COMPLETED',
        ...(user.role === 'TASKER'
          ? { assignments: { some: { tasker: { userId: user.id } } } }
          : { customerId: user.id }),
      },
    })

    return NextResponse.json({
      totalEarned,
      pendingAmount,
      availableBalance: totalEarned - pendingAmount,
      completedJobs,
      recentPayouts: payouts.slice(0, 20).map(p => ({
        id: p.id,
        amount: Number(p.amount) / 100,
        description: p.description,
        status: p.status,
        source: p.source,
        createdAt: p.createdAt.toISOString(),
        clearedAt: p.clearedAt?.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Earnings error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
