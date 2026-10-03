import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryCodes,
  guardCrmRequest,
} from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'
import {
  DEFAULT_LK_LKR_POLICY,
} from '@/lib/finance/commissions/provider-balance-service'
import { validateProviderFinancialPolicy } from '@/lib/finance/commissions/provider-financial-policy'

const PROVIDER_TYPES = new Set(['TASKER', 'COMPANY'])

function serializePolicy(policy: any) {
  return {
    id: policy.id,
    countryCode: policy.countryCode,
    providerType: policy.providerType,
    currency: policy.currency,
    warningThresholdMinor: policy.warningThresholdMinor.toString(),
    cashRestrictionThresholdMinor: policy.cashRestrictionThresholdMinor.toString(),
    reviewThresholdMinor: policy.reviewThresholdMinor.toString(),
    maxDebtAgeDays: policy.maxDebtAgeDays,
    allowOnlineWhenCashRestricted: policy.allowOnlineWhenCashRestricted,
    autoOffsetOnlineEarnings: policy.autoOffsetOnlineEarnings,
    settlementCadence: policy.settlementCadence,
    enabled: policy.enabled,
    updatedBy: policy.updatedBy,
    createdAt: policy.createdAt?.toISOString?.() || null,
    updatedAt: policy.updatedAt?.toISOString?.() || null,
  }
}

function defaultPolicy(providerType: 'TASKER' | 'COMPANY') {
  return {
    id: null,
    countryCode: 'LK',
    providerType,
    currency: 'LKR',
    warningThresholdMinor: DEFAULT_LK_LKR_POLICY.warningThresholdMinor.toString(),
    cashRestrictionThresholdMinor: DEFAULT_LK_LKR_POLICY.cashRestrictionThresholdMinor.toString(),
    reviewThresholdMinor: DEFAULT_LK_LKR_POLICY.reviewThresholdMinor.toString(),
    maxDebtAgeDays: DEFAULT_LK_LKR_POLICY.maxDebtAgeDays,
    allowOnlineWhenCashRestricted: DEFAULT_LK_LKR_POLICY.allowOnlineWhenCashRestricted,
    autoOffsetOnlineEarnings: DEFAULT_LK_LKR_POLICY.autoOffsetOnlineEarnings,
    settlementCadence: providerType === 'COMPANY' ? 'WEEKLY' : 'REALTIME',
    enabled: true,
    updatedBy: null,
    createdAt: null,
    updatedAt: null,
    inheritedDefault: true,
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

    const countries = requested && requested !== 'ALL'
      ? [requested]
      : scopedCountries

    const policies = await prisma.providerFinancialPolicyConfig.findMany({
      where: countries === null ? undefined : { countryCode: { in: countries } },
      orderBy: [{ countryCode: 'asc' }, { providerType: 'asc' }, { currency: 'asc' }],
    })

    const serialized = policies.map(policy => ({ ...serializePolicy(policy), inheritedDefault: false }))

    if ((countries === null || countries.includes('LK')) && !requested || requested === 'LK' || requested === 'ALL') {
      for (const providerType of ['TASKER', 'COMPANY'] as const) {
        const exists = serialized.some(
          policy =>
            policy.countryCode === 'LK' &&
            policy.providerType === providerType &&
            policy.currency === 'LKR',
        )
        if (!exists) serialized.push(defaultPolicy(providerType))
      }
    }

    return NextResponse.json({
      policies: serialized,
      canManage: security.isSuperAdmin,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('CRM provider financial policy GET error:', error)
    return NextResponse.json({ error: 'Failed to load provider financial policies' }, { status: 500 })
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
    const countryCode =
      typeof body.countryCode === 'string' ? body.countryCode.trim().toUpperCase() : ''
    const providerType =
      typeof body.providerType === 'string' ? body.providerType.trim().toUpperCase() : ''
    const currency =
      typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : ''
    const reason =
      typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) : ''

    if (!/^[A-Z]{2}$/.test(countryCode)) {
      return NextResponse.json({ error: 'Valid countryCode is required' }, { status: 400 })
    }
    if (!assertCrmCountryAllowed(security, countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!PROVIDER_TYPES.has(providerType)) {
      return NextResponse.json({ error: 'providerType must be TASKER or COMPANY' }, { status: 400 })
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json({ error: 'Valid currency is required' }, { status: 400 })
    }
    if (reason.length < 4) {
      return NextResponse.json({ error: 'A clear policy change reason is required' }, { status: 400 })
    }

    let warningThresholdMinor: bigint
    let cashRestrictionThresholdMinor: bigint
    let reviewThresholdMinor: bigint
    try {
      warningThresholdMinor = BigInt(String(body.warningThresholdMinor))
      cashRestrictionThresholdMinor = BigInt(String(body.cashRestrictionThresholdMinor))
      reviewThresholdMinor = BigInt(String(body.reviewThresholdMinor))
    } catch {
      return NextResponse.json({ error: 'Thresholds must be integer minor-unit amounts' }, { status: 400 })
    }

    const maxDebtAgeDays = Number(body.maxDebtAgeDays)
    const settlementCadence =
      typeof body.settlementCadence === 'string'
        ? body.settlementCadence.trim().toUpperCase()
        : ''
    if (!['REALTIME', 'WEEKLY'].includes(settlementCadence)) {
      return NextResponse.json({ error: 'Invalid settlement cadence' }, { status: 400 })
    }

    try {
      validateProviderFinancialPolicy({
        warningThresholdMinor,
        cashRestrictionThresholdMinor,
        reviewThresholdMinor,
        maxDebtAgeDays,
        allowOnlineWhenCashRestricted: body.allowOnlineWhenCashRestricted !== false,
        autoOffsetOnlineEarnings: body.autoOffsetOnlineEarnings !== false,
      })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid financial policy' },
        { status: 400 },
      )
    }

    const before = await prisma.providerFinancialPolicyConfig.findUnique({
      where: {
        countryCode_providerType_currency: {
          countryCode,
          providerType,
          currency,
        },
      },
    })

    const policy = await prisma.providerFinancialPolicyConfig.upsert({
      where: {
        countryCode_providerType_currency: {
          countryCode,
          providerType,
          currency,
        },
      },
      create: {
        countryCode,
        providerType,
        currency,
        warningThresholdMinor,
        cashRestrictionThresholdMinor,
        reviewThresholdMinor,
        maxDebtAgeDays,
        allowOnlineWhenCashRestricted: body.allowOnlineWhenCashRestricted !== false,
        autoOffsetOnlineEarnings: body.autoOffsetOnlineEarnings !== false,
        settlementCadence,
        enabled: body.enabled !== false,
        updatedBy: security.adminId,
      },
      update: {
        warningThresholdMinor,
        cashRestrictionThresholdMinor,
        reviewThresholdMinor,
        maxDebtAgeDays,
        allowOnlineWhenCashRestricted: body.allowOnlineWhenCashRestricted !== false,
        autoOffsetOnlineEarnings: body.autoOffsetOnlineEarnings !== false,
        settlementCadence,
        enabled: body.enabled !== false,
        updatedBy: security.adminId,
      },
    })

    await createAuditLog({
      action: 'PROVIDER_FINANCIAL_POLICY_UPDATED',
      category: 'finance',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'ProviderFinancialPolicyConfig',
      entityId: policy.id,
      entityName: `${countryCode}:${providerType}:${currency}`,
      description: `Provider financial standing policy updated: ${reason}`,
      oldValue: before ? serializePolicy(before) : undefined,
      newValue: serializePolicy(policy),
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      sessionId: security.sessionId,
      riskLevel: 'HIGH',
    })

    return NextResponse.json({
      success: true,
      policy: { ...serializePolicy(policy), inheritedDefault: false },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('CRM provider financial policy PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update provider financial policy' }, { status: 500 })
  }
}
