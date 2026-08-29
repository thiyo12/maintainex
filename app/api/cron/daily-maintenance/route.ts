import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) throw new Error('[SECURITY] CRON_SECRET env var is required')
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Lift expired suspensions
    const suspendedUsers = await prisma.user.findMany({
      where: {
        isSuspended: true,
        suspendedUntil: { lte: new Date() },
      },
    })

    for (const user of suspendedUsers) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isSuspended: false, suspendedUntil: null },
      })
    }

    // Process pending payouts
    const pendingPayouts = await prisma.payoutRequest.findMany({
      where: { status: 'pending' },
    })

    let processed = 0
    for (const payout of pendingPayouts) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      if (new Date(payout.createdAt) <= oneDayAgo) {
        await prisma.payoutRequest.update({
          where: { id: payout.id },
          data: { status: 'processing' },
        })
        processed++
      }
    }

    return NextResponse.json({
      success: true,
      suspensionsLifted: suspendedUsers.length,
      payoutsProcessing: processed,
    })
  } catch (error) {
    console.error('[CRON] Daily maintenance error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
