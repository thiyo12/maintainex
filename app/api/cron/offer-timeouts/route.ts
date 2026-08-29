import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyNextOfferCandidate } from '@/lib/offer-matcher'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) throw new Error('[SECURITY] CRON_SECRET env var is required')
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const expired = await prisma.offerMatchQueue.groupBy({
      by: ['bookingId'],
      where: {
        status: 'notified',
        expiresAt: { lte: new Date() },
      },
    })

    for (const row of expired) {
      await prisma.offerMatchQueue.updateMany({
        where: { bookingId: row.bookingId, status: 'notified' },
        data: { status: 'expired' },
      })
      await notifyNextOfferCandidate(row.bookingId)
    }

    return NextResponse.json({ success: true, expired: expired.length })
  } catch (error) {
    console.error('[CRON] Offer timeout error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
