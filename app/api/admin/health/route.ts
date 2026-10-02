import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'health:view',
      level: 'read',
    })
    if (!guard.ok) return guard.response

    const started = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const dbLatencyMs = Date.now() - started
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const [jobQueuePending, offerQueuePending, notificationsLastHour, paymentPending] = await Promise.all([
      prisma.jobMatchQueue.count({ where: { status: 'pending' } }),
      prisma.offerMatchQueue.count({ where: { status: 'pending' } }),
      prisma.notification.count({ where: { createdAt: { gte: oneHourAgo } } }),
      prisma.paymentIntent.count({ where: { status: { in: ['CREATED', 'PENDING', 'REFUND_PROCESSING'] } } }),
    ])

    const paypalConfigured = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
    const paypalWebhookConfigured = Boolean(process.env.PAYPAL_WEBHOOK_ID)
    const cloudinaryConfigured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
    const cronConfigured = Boolean(process.env.CRON_SECRET)

    return NextResponse.json({
      status: dbLatencyMs < 1000 ? 'healthy' : 'degraded',
      release: process.env.APP_RELEASE_SHA || 'unknown',
      checkedAt: new Date().toISOString(),
      database: { status: 'healthy', latencyMs: dbLatencyMs },
      queues: { jobMatchPending: jobQueuePending, offerMatchPending: offerQueuePending },
      payments: { pending: paymentPending, paypalConfigured, paypalWebhookConfigured, sandbox: process.env.PAYPAL_SANDBOX !== 'false' },
      notifications: { createdLastHour: notificationsLastHour, expoPushAvailable: true, mediaStorageConfigured: cloudinaryConfigured },
      cron: { configured: cronConfigured },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('CRM health GET error:', error)
    return NextResponse.json({ error: 'System health unavailable' }, { status: 503 })
  }
}
