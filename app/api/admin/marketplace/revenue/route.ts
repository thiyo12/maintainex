import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie, adminAuthorize } from '@/lib/admin-rbac'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const toDate = to ? new Date(to + 'T23:59:59.999Z') : new Date()

    const transactions = await prisma.walletTransaction.findMany({
      where: {
        createdAt: { gte: fromDate, lte: toDate },
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
    })

    // Stat aggregates
    const credits = transactions.filter((t) => t.type === 'CREDIT')
    const totalRevenue = credits.reduce((sum, t) => sum + t.amount, 0)
    const totalTransactions = transactions.length
    const avgTransaction = totalTransactions > 0 ? totalRevenue / credits.length || 0 : 0

    const serviceFees = transactions.filter((t) => t.referenceType === 'SERVICE_FEE')
    const platformFeeCollected = serviceFees.reduce((sum, t) => sum + t.amount, 0)

    // Daily revenue (group CREDIT by day)
    const dailyMap = new Map<string, { revenue: number; transactions: number; fees: number }>()
    for (const t of credits) {
      const day = t.createdAt.toISOString().slice(0, 10)
      const entry = dailyMap.get(day) || { revenue: 0, transactions: 0, fees: 0 }
      entry.revenue += t.amount
      entry.transactions += 1
      dailyMap.set(day, entry)
    }
    for (const t of serviceFees) {
      const day = t.createdAt.toISOString().slice(0, 10)
      const entry = dailyMap.get(day)
      if (entry) entry.fees += t.amount
    }
    const dailyRevenue = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Top 10 providers by earnings (CREDIT transactions, walletType = PROVIDER)
    const providerCredits = credits.filter((t) => t.walletType === 'PROVIDER')
    const providerMap = new Map<string, { totalEarnings: number; jobsCompleted: number }>()
    for (const t of providerCredits) {
      const entry = providerMap.get(t.userId) || { totalEarnings: 0, jobsCompleted: 0 }
      entry.totalEarnings += t.amount
      if (t.referenceType === 'ESCROW_RELEASE') entry.jobsCompleted += 1
      providerMap.set(t.userId, entry)
    }
    const topProviderIds = Array.from(providerMap.entries())
      .sort((a, b) => b[1].totalEarnings - a[1].totalEarnings)
      .slice(0, 10)
      .map(([userId]) => userId)

    const providerProfiles = await prisma.taskerProfile.findMany({
      where: { userId: { in: topProviderIds } },
      include: { user: { select: { name: true, email: true } } },
    })
    const providerLookup = new Map(providerProfiles.map((p) => [p.userId, p]))

    const topProviders = topProviderIds.map((userId) => {
      const stats = providerMap.get(userId)!
      const profile = providerLookup.get(userId)
      return {
        userId,
        name: profile?.user?.name || profile?.user?.email || userId,
        jobsCompleted: stats.jobsCompleted,
        totalEarnings: stats.totalEarnings,
      }
    })

    // Recent 50 transactions
    const recentTransactions = transactions.slice(0, 50).map((t) => ({
      id: t.id,
      userId: t.userId,
      walletType: t.walletType,
      type: t.type,
      amount: t.amount,
      reference: t.reference,
      referenceType: t.referenceType,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalRevenue,
          totalTransactions,
          avgTransaction,
          platformFeeCollected,
        },
        dailyRevenue,
        topProviders,
        recentTransactions,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 })
  }
}
