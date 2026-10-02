import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryCodes,
  guardCrmRequest,
} from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'
import {
  getPayHereConfig,
  getPayHereMerchantApiConfig,
} from '@/lib/payment/payhere-adapter'
import { getPayPalConfig } from '@/lib/finance/payments/paypal-adapter'
import {
  normalizePaymentProvider,
  parseProviderCapabilities,
  parseProviderList,
} from '@/lib/finance/payments/provider-registry'

const ENVIRONMENTS = new Set(['SANDBOX', 'LIVE'])
const OPERATIONAL_STATUSES = new Set(['DISABLED', 'ACTIVE', 'DEGRADED', 'MAINTENANCE'])
const CAPTURE_MODES = new Set(['CAPTURE', 'AUTHORIZE'])
const CAPABILITY_KEYS = new Set([
  'checkout', 'authorize', 'capture', 'refund', 'partialRefund',
  'webhooks', 'disputes', 'payouts', 'reconciliation',
])

function safeJson(raw: string | null) {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

function stringArray(value: unknown, max = 20): string[] | null {
  if (!Array.isArray(value) || value.length > max) return null
  const values = value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().toUpperCase())
    .filter(Boolean)
  if (values.length !== value.length) return null
  return [...new Set(values)]
}

function capabilities(value: unknown): Record<string, boolean> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result: Record<string, boolean> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (!CAPABILITY_KEYS.has(key) || typeof child !== 'boolean') return null
    result[key] = child
  }
  return result
}

function runtimeState(provider: string) {
  if (provider === 'PAYPAL') {
    const config = getPayPalConfig()
    return {
      configured: Boolean(config),
      environment: config ? (config.sandbox ? 'SANDBOX' : 'LIVE') : null,
      webhookConfigured: Boolean(config?.webhookId),
      refundConfigured: Boolean(config),
    }
  }
  if (provider === 'PAYHERE') {
    const config = getPayHereConfig()
    const merchantApi = getPayHereMerchantApiConfig()
    return {
      configured: Boolean(config),
      environment: config ? (config.sandbox ? 'SANDBOX' : 'LIVE') : null,
      webhookConfigured: Boolean(config),
      refundConfigured: Boolean(merchantApi),
    }
  }
  if (provider === 'MANUAL_BANK') {
    return {
      configured: true,
      environment: 'LIVE',
      webhookConfigured: false,
      refundConfigured: false,
    }
  }
  return {
    configured: false,
    environment: null,
    webhookConfigured: false,
    refundConfigured: false,
  }
}

function serializeConfig(config: any) {
  return {
    ...config,
    supportedCurrencies: parseProviderList(config.supportedCurrencies),
    paymentMethods: parseProviderList(config.paymentMethods),
    capabilities: parseProviderCapabilities(config.capabilities),
    refundPolicy: safeJson(config.refundPolicy),
    settlementConfig: safeJson(config.settlementConfig),
    feeConfig: safeJson(config.feeConfig),
    runtime: runtimeState(config.provider),
  }
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'finance:payments:view',
      permissionClass: 'READ',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const scopedCountries = getCrmCountryCodes(security)
    const requested = request.nextUrl.searchParams.get('countryCode')?.trim().toUpperCase() || ''
    if (requested && requested !== 'ALL' && !assertCrmCountryAllowed(security, requested)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const countryFilter = requested && requested !== 'ALL' ? [requested] : scopedCountries
    const where = countryFilter === null ? undefined : { countryCode: { in: countryFilter } }

    const configs = await prisma.paymentProviderConfig.findMany({
      where,
      orderBy: [{ countryCode: 'asc' }, { priority: 'asc' }, { provider: 'asc' }],
    })

    const [transactionCounts, eventCounts] = await Promise.all([
      prisma.paymentProviderTransaction.groupBy({
        by: ['countryCode', 'provider', 'status', 'currency'],
        where,
        _count: { _all: true },
        _sum: { grossAmount: true, providerFee: true, netSettlement: true },
      }),
      prisma.paymentProviderEvent.groupBy({
        by: ['countryCode', 'provider', 'processingStatus'],
        where,
        _count: { _all: true },
      }),
    ])

    return NextResponse.json({
      configs: configs.map(serializeConfig),
      transactionStats: transactionCounts.map(row => ({
        countryCode: row.countryCode, provider: row.provider, status: row.status,
        currency: row.currency, count: row._count._all,
        grossAmount: row._sum.grossAmount?.toString() || '0',
        providerFee: row._sum.providerFee?.toString() || '0',
        netSettlement: row._sum.netSettlement?.toString() || '0',
      })),
      eventStats: eventCounts.map(row => ({
        countryCode: row.countryCode, provider: row.provider,
        processingStatus: row.processingStatus, count: row._count._all,
      })),
      canManage: security.isSuperAdmin,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('CRM payment provider GET error:', error)
    return NextResponse.json({ error: 'Failed to load payment providers' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'markets:manage',
      allowedRoles: ['SUPER_ADMIN'],
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const countryCode = typeof body.countryCode === 'string' ? body.countryCode.trim().toUpperCase() : ''
    const provider = typeof body.provider === 'string' ? normalizePaymentProvider(body.provider) : null
    const environment = typeof body.environment === 'string' ? body.environment.trim().toUpperCase() : ''
    const operationalStatus = typeof body.operationalStatus === 'string' ? body.operationalStatus.trim().toUpperCase() : ''
    const captureMode = typeof body.captureMode === 'string' ? body.captureMode.trim().toUpperCase() : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) : ''

    if (!/^[A-Z]{2}$/.test(countryCode)) return NextResponse.json({ error: 'Valid countryCode is required' }, { status: 400 })
    if (!provider) return NextResponse.json({ error: 'Supported provider is required' }, { status: 400 })
    if (!ENVIRONMENTS.has(environment)) return NextResponse.json({ error: 'Invalid environment' }, { status: 400 })
    if (!OPERATIONAL_STATUSES.has(operationalStatus)) return NextResponse.json({ error: 'Invalid operational status' }, { status: 400 })
    if (!CAPTURE_MODES.has(captureMode)) return NextResponse.json({ error: 'Invalid capture mode' }, { status: 400 })
    if (reason.length < 4) return NextResponse.json({ error: 'A clear change reason is required' }, { status: 400 })

    const supportedCurrencies = stringArray(body.supportedCurrencies)
    const paymentMethods = stringArray(body.paymentMethods)
    const capabilityMap = capabilities(body.capabilities)
    if (!supportedCurrencies?.length || supportedCurrencies.some(code => !/^[A-Z]{3}$/.test(code))) {
      return NextResponse.json({ error: 'At least one valid currency is required' }, { status: 400 })
    }
    if (!paymentMethods || !capabilityMap) return NextResponse.json({ error: 'Invalid provider methods or capabilities' }, { status: 400 })

    const enabled = body.enabled === true
    const priority = Number(body.priority)
    const commissionRateBps = body.commissionRateBps == null ? null : Number(body.commissionRateBps)
    if (!Number.isInteger(priority) || priority < 0 || priority > 10000) {
      return NextResponse.json({ error: 'Priority must be an integer from 0 to 10000' }, { status: 400 })
    }
    if (commissionRateBps !== null && (!Number.isInteger(commissionRateBps) || commissionRateBps < 0 || commissionRateBps > 10000)) {
      return NextResponse.json({ error: 'Commission BPS must be 0 to 10000' }, { status: 400 })
    }

    const runtime = runtimeState(provider)
    if (enabled && (!runtime.configured || runtime.environment !== environment)) {
      return NextResponse.json({ error: provider + ' cannot be enabled until its server runtime is configured for ' + environment }, { status: 409 })
    }
    if (enabled && captureMode !== 'CAPTURE') {
      return NextResponse.json(
        { error: provider + ' authorize-only mode is not implemented in the canonical checkout flow' },
        { status: 409 }
      )
    }
    if (enabled && provider === 'MANUAL_BANK' && capabilityMap.checkout === true) {
      return NextResponse.json(
        { error: 'MANUAL_BANK cannot be enabled for hosted checkout until a canonical bank-transfer payment flow is implemented' },
        { status: 409 }
      )
    }
    if (enabled && capabilityMap.webhooks === true && !runtime.webhookConfigured) {
      return NextResponse.json({ error: provider + ' webhook verification is not configured' }, { status: 409 })
    }
    if (
      enabled &&
      (capabilityMap.refund === true || capabilityMap.reconciliation === true) &&
      !runtime.refundConfigured
    ) {
      return NextResponse.json(
        { error: provider + ' refund/reconciliation runtime is not configured' },
        { status: 409 }
      )
    }

    const before = await prisma.paymentProviderConfig.findUnique({
      where: { countryCode_provider: { countryCode, provider } },
    })

    const write = {
      enabled, environment,
      supportedCurrencies: JSON.stringify(supportedCurrencies),
      paymentMethods: JSON.stringify(paymentMethods),
      capabilities: JSON.stringify(capabilityMap),
      captureMode, operationalStatus, priority, commissionRateBps,
      refundPolicy: body.refundPolicy ? JSON.stringify(body.refundPolicy) : null,
      settlementConfig: body.settlementConfig ? JSON.stringify(body.settlementConfig) : null,
      feeConfig: body.feeConfig ? JSON.stringify(body.feeConfig) : null,
      updatedBy: security.adminId,
    }

    const config = await prisma.paymentProviderConfig.upsert({
      where: { countryCode_provider: { countryCode, provider } },
      create: { countryCode, provider, ...write },
      update: write,
    })

    await createAuditLog({
      action: 'PAYMENT_PROVIDER_CONFIG_UPDATED',
      category: 'finance',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'PaymentProviderConfig',
      entityId: config.id,
      entityName: countryCode + ':' + provider,
      description: 'Payment provider configuration updated: ' + reason,
      oldValue: before ? serializeConfig(before) : undefined,
      newValue: serializeConfig(config),
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      sessionId: security.sessionId,
      riskLevel: enabled ? 'CRITICAL' : 'HIGH',
    })

    return NextResponse.json({ success: true, config: serializeConfig(config) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('CRM payment provider PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update payment provider configuration' }, { status: 500 })
  }
}