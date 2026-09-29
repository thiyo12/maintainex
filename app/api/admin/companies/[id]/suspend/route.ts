import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest, assertCrmCountryAllowed } from '@/lib/crm/security'
import { suspendCompany } from '@/lib/domain/admin-suspension'
import type { AdminSession } from '@/lib/admin-types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'companies:edit',
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
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 1000) : ''
    if (reason.length < 3) {
      return NextResponse.json({ error: 'Reason is required (minimum 3 characters)' }, { status: 400 })
    }

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

    const result = await suspendCompany(prisma, {
      companyProfileId: id,
      reason,
      scope: 'ALL',
      session,
      ipAddress: security.ipAddress,
    })

    return NextResponse.json({
      success: true,
      company: { id: result.companyProfileId, verificationStatus: 'SUSPENDED' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('already suspended')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    console.error('CRM company suspend error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
