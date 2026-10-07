import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest, assertCrmCountryAllowed } from '@/lib/crm/security'
import { reactivateCompany } from '@/lib/domain/admin-suspension'
import type { AdminSession } from '@/lib/admin-types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'companies:status:manage',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    if (!id || id.length > 128) {
      return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const reason = typeof body?.reason === 'string'
      ? body.reason.trim().slice(0, 1000)
      : 'Reactivated by admin'

    const company = await prisma.companyProfile.findUnique({
      where: { id },
      select: { id: true, countryCode: true },
    })
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, company.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const session: AdminSession = {
      id: security.adminId,
      email: security.email,
      role: security.role,
      firstName: '',
      lastName: '',
      assignedCountries: security.assignedCountries,
      authType: 'adminUser',
    }

    const result = await reactivateCompany(prisma, {
      companyProfileId: id,
      reason,
      session,
      ipAddress: security.ipAddress,
    })

    return NextResponse.json({
      success: true,
      company: { id: result.companyProfileId, verificationStatus: 'VERIFIED' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('not suspended')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    secureConsole.error('CRM company reactivate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
