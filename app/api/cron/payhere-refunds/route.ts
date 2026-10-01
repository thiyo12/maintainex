import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  reconcilePayHereRefund,
  requestRequiredPayHereRefund,
} from '@/lib/finance/payments/payment-service'

export const dynamic = 'force-dynamic'

const MAX_BATCH = 8

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[SECURITY] CRON_SECRET env var is required for PayHere refund worker')
    return NextResponse.json({ error: 'Worker not configured' }, { status: 503 })
  }

  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const queued = await prisma.paymentIntent.findMany({
      where: {
        status: { in: ['REFUND_REQUIRED', 'REFUND_PROCESSING'] },
      },
      select: {
        id: true,
        status: true,
        merchantOrderId: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'asc' },
      take: MAX_BATCH,
    })

    const outcomes: Array<{
      paymentIntentId: string
      before: string
      after: string
      success: boolean
      code?: string
    }> = []

    for (const intent of queued) {
      try {
        const result = intent.status === 'REFUND_REQUIRED'
          ? await requestRequiredPayHereRefund(intent.id)
          : await reconcilePayHereRefund(intent.id)

        outcomes.push({
          paymentIntentId: intent.id,
          before: intent.status,
          after: result.status,
          success: result.success,
          ...(result.code ? { code: result.code } : {}),
        })
      } catch (error) {
        console.error('[CRON] PayHere refund item failed', {
          paymentIntentId: intent.id,
          orderId: intent.merchantOrderId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        outcomes.push({
          paymentIntentId: intent.id,
          before: intent.status,
          after: intent.status,
          success: false,
          code: 'UNEXPECTED_REFUND_WORKER_ERROR',
        })
      }
    }

    return NextResponse.json({
      success: true,
      queued: queued.length,
      completed: outcomes.filter(item => item.after === 'REFUNDED').length,
      processing: outcomes.filter(item => item.after === 'REFUND_PROCESSING').length,
      requiresAttention: outcomes.filter(item => !item.success).length,
      outcomes,
    })
  } catch (error) {
    console.error('[CRON] PayHere refund worker failed:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
