import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateMarketConfig } from '@/lib/domain/market-config'
import { assertCrmCountryAllowed, guardCrmRequest, type CrmSecurityContext } from '@/lib/crm/security'
import { evaluateEffectivePermission, getPermissionCatalogEntry } from '@/lib/crm/governance'
import type { AdminSession } from '@/lib/admin-types'

const PRICING_FIELDS = new Set([
  'commissionRateBps',
  'urgentModifierBps',
  'emergencyModifierBps',
  'urgencyCapBps',
  'minJobAmountCents',
  'maxJobAmountCents',
  'minBenchmarkSample',
  'benchmarkPercentileLow',
  'benchmarkPercentileHigh',
  'benchmarkOutlierIqrMult',
  'benchmarkFallbackEnabled',
  'benchmarkResearchIntervalMonths',
])

function can(context: CrmSecurityContext, permission: string): boolean {
  const entry = getPermissionCatalogEntry(permission)
  return evaluateEffectivePermission({
    role: context.role,
    permission,
    permissionClass: entry?.class,
    overrides: context.permissionOverrides,
  }).allowed
}

function sessionFromGuard(context: CrmSecurityContext): AdminSession {
  return {
    id: context.adminId,
    email: context.email,
    role: context.role,
    firstName: '',
    lastName: '',
    assignedCountries: context.assignedCountries,
    authType: 'adminUser',
  }
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'markets:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const countryCode = (searchParams.get('countryCode') || 'GLOBAL').trim().toUpperCase()

    if (countryCode !== 'GLOBAL' && !assertCrmCountryAllowed(security, countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (countryCode === 'GLOBAL' && !security.isSuperAdmin) {
      return NextResponse.json({ error: 'SUPER_ADMIN required for GLOBAL market config' }, { status: 403 })
    }

    const config = await prisma.marketConfig.findUnique({ where: { countryCode } })
    return NextResponse.json({ config }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    secureConsole.error('CRM market config GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'markets:manage',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const countryCode = typeof body?.countryCode === 'string'
      ? body.countryCode.trim().toUpperCase()
      : ''
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 2000) : undefined
    const { countryCode: _countryCode, reason: _reason, ...changes } = body || {}

    if (Object.keys(changes).some(key => PRICING_FIELDS.has(key)) && !can(security, 'pricing:manage')) {
      return NextResponse.json(
        { error: 'Pricing-affecting market changes require pricing:manage' },
        { status: 403 }
      )
    }

    if (!countryCode) {
      return NextResponse.json({ error: 'countryCode is required' }, { status: 400 })
    }
    if (countryCode === 'GLOBAL' && !security.isSuperAdmin) {
      return NextResponse.json({ error: 'SUPER_ADMIN required for GLOBAL market config' }, { status: 403 })
    }
    if (countryCode !== 'GLOBAL' && !assertCrmCountryAllowed(security, countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await updateMarketConfig(prisma, {
      countryCode,
      changes,
      reason,
      session: sessionFromGuard(security),
      ipAddress: security.ipAddress,
    })

    return NextResponse.json({ success: true, config: result.config })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('Validation failed') || message.includes('No valid fields')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message.includes('Concurrent modification')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    secureConsole.error('CRM market config PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
