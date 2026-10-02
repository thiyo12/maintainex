import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCrmCountryCodes, guardCrmRequest } from '@/lib/crm/security'
import {
  getPayHereConfig,
  getPayHereMerchantApiConfig,
} from '@/lib/payment/payhere-adapter'
import { getPayPalConfig } from '@/lib/finance/payments/paypal-adapter'
import { parseProviderCapabilities } from '@/lib/finance/payments/provider-registry'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'health:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context
    const scopedCountries = getCrmCountryCodes(security)

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

    const paypal = getPayPalConfig()
    const payhere = getPayHereConfig()
    const payhereMerchantApi = getPayHereMerchantApiConfig()
    const paypalConfigured = Boolean(paypal)
    const paypalWebhookConfigured = Boolean(paypal?.webhookId)
    const providerConfigs = await prisma.paymentProviderConfig.findMany({
      where: scopedCountries === null
        ? undefined
        : { countryCode: { in: scopedCountries } },
      orderBy: [{ countryCode: 'asc' }, { priority: 'asc' }],
    })

    const providerHealth = providerConfigs.map(config => {
      const runtime =
        config.provider === 'PAYPAL'
          ? {
              configured: Boolean(paypal),
              environment: paypal ? (paypal.sandbox ? 'SANDBOX' : 'LIVE') : null,
              webhookConfigured: Boolean(paypal?.webhookId),
              refundConfigured: Boolean(paypal),
            }
          : config.provider === 'PAYHERE'
            ? {
                configured: Boolean(payhere),
                environment: payhere ? (payhere.sandbox ? 'SANDBOX' : 'LIVE') : null,
                webhookConfigured: Boolean(payhere),
                refundConfigured: Boolean(payhereMerchantApi),
              }
            : {
                configured: config.provider === 'MANUAL_BANK',
                environment: config.provider === 'MANUAL_BANK' ? 'LIVE' : null,
                webhookConfigured: false,
                refundConfigured: false,
              }

      const capabilities = parseProviderCapabilities(config.capabilities)
      const healthy =
        !config.enabled ||
        (
          config.operationalStatus === 'ACTIVE' &&
          runtime.configured &&
          runtime.environment === config.environment &&
          (!capabilities.webhooks || runtime.webhookConfigured) &&
          (!(capabilities.refund || capabilities.reconciliation) || runtime.refundConfigured) &&
          !(config.provider === 'MANUAL_BANK' && capabilities.checkout)
        )

      return {
        countryCode: config.countryCode,
        provider: config.provider,
        enabled: config.enabled,
        operationalStatus: config.operationalStatus,
        configuredEnvironment: config.environment,
        runtimeEnvironment: runtime.environment,
        runtimeConfigured: runtime.configured,
        webhookConfigured: runtime.webhookConfigured,
        refundConfigured: runtime.refundConfigured,
        status: healthy ? 'healthy' : 'degraded',
      }
    })

    const providerDegraded = providerHealth.some(item => item.status === 'degraded')
    const cloudinaryConfigured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
    const cronConfigured = Boolean(process.env.CRON_SECRET)

    return NextResponse.json({
      status: dbLatencyMs < 1000 && !providerDegraded ? 'healthy' : 'degraded',
      release: process.env.APP_RELEASE_SHA || 'unknown',
      checkedAt: new Date().toISOString(),
      database: { status: 'healthy', latencyMs: dbLatencyMs },
      queues: { jobMatchPending: jobQueuePending, offerMatchPending: offerQueuePending },
      payments: {
        pending: paymentPending,
        paypalConfigured,
        paypalWebhookConfigured,
        sandbox: process.env.PAYPAL_SANDBOX !== 'false',
        providers: providerHealth,
      },
      notifications: { createdLastHour: notificationsLastHour, expoPushAvailable: true, mediaStorageConfigured: cloudinaryConfigured },
      cron: { configured: cronConfigured },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('CRM health GET error:', error)
    return NextResponse.json({ error: 'System health unavailable' }, { status: 503 })
  }
}
