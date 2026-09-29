import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateMarketConfig } from '@/lib/domain/market-config'
import {
  assertCrmCountryAllowed,
  guardCrmRequest,
  type CrmSecurityContext,
} from '@/lib/crm/security'
import type { AdminSession } from '@/lib/admin-types'

const ALLOWED_FIELDS = new Set([
  'minBenchmarkSample',
  'benchmarkPercentileLow',
  'benchmarkPercentileHigh',
  'benchmarkOutlierIqrMult',
  'benchmarkFallbackEnabled',
  'benchmarkResearchIntervalMonths',
])

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

function assertMarketAccess(context: CrmSecurityContext, countryCode: string) {
  if (countryCode === 'GLOBAL') return context.isSuperAdmin
  return assertCrmCountryAllowed(context, countryCode)
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'pricing_config:read',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const countryCode = (searchParams.get('countryCode') || 'GLOBAL').trim().toUpperCase()

    if (!assertMarketAccess(security, countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const config = await prisma.marketConfig.findUnique({ where: { countryCode } })
    return NextResponse.json({ config }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('CRM pricing config GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'pricing_config:write',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const countryCode = typeof body?.countryCode === 'string'
      ? body.countryCode.trim().toUpperCase()
      : ''
    const reason = typeof body?.reason === 'string'
      ? body.reason.trim().slice(0, 2000)
      : 'Pricing intelligence configuration updated'

    if (!countryCode) {
      return NextResponse.json({ error: 'countryCode is required' }, { status: 400 })
    }
    if (!assertMarketAccess(security, countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const changes: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body || {})) {
      if (ALLOWED_FIELDS.has(key)) changes[key] = value
    }

    const result = await updateMarketConfig(prisma, {
      countryCode,
      changes,
      reason,
      session: sessionFromGuard(security),
      ipAddress: security.ipAddress,
    })

    return NextResponse.json({ config: result.config })
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
    console.error('CRM pricing config PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
