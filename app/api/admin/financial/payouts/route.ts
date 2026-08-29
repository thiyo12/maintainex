import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'FINANCE']

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {}
    if (status) where.status = status

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payout.count({ where }),
    ])

    const userIds = [...new Set(payouts.map(p => p.userId))]
    const [users, wallets] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, mxId: true },
      }),
      prisma.providerWallet.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, availableBalance: true, isFrozen: true },
      }),
    ])
    const userMap = new Map(users.map(u => [u.id, u]))
    const walletMap = new Map(wallets.map(w => [w.userId, w]))

    const [pendingTotal, clearedTotal, rejectedTotal, failedTotal] = await Promise.all([
      prisma.payout.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true } }),
      prisma.payout.aggregate({ where: { status: { in: ['CLEARED', 'RELEASED'] } }, _sum: { amount: true } }),
      prisma.payout.count({ where: { status: 'REJECTED' } }),
      prisma.payout.count({ where: { status: 'FAILED' } }),
    ])

    return NextResponse.json({
      payouts: payouts.map(p => ({
        id: p.id,
        userId: p.userId,
        user: userMap.get(p.userId) || null,
        amount: Number(p.amount),
        amountLkr: Number(p.amount) / 100,
        description: p.description,
        status: p.status,
        source: p.source,
        sourceId: p.sourceId,
        method: p.method,
        bankDetails: p.bankDetails,
        rejectedReason: p.rejectedReason,
        processedBy: p.processedBy,
        createdAt: p.createdAt.toISOString(),
        clearedAt: p.clearedAt?.toISOString() || null,
        walletAvailable: walletMap.get(p.userId)?.availableBalance ?? 0,
        walletFrozen: walletMap.get(p.userId)?.isFrozen ?? false,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        pendingAmount: Number(pendingTotal._sum?.amount || 0) / 100,
        clearedAmount: Number(clearedTotal._sum?.amount || 0) / 100,
        rejectedCount: rejectedTotal,
        failedCount: failedTotal,
      },
    })
  } catch (error) {
    console.error('Payouts GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 })
  }
}