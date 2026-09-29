import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest, assertCrmCountryAllowed } from '@/lib/crm/security'
import { transitionCompanyVerification } from '@/lib/phase6/kyc-writer'

const VALID_ACTIONS = ['SUBMIT', 'APPROVE', 'REJECT', 'SUSPEND'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'companies:verify',
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
    const action = typeof body?.action === 'string' ? body.action.toUpperCase() : ''
    const reviewNote = typeof body?.reviewNote === 'string'
      ? body.reviewNote.trim().slice(0, 2000)
      : undefined

    if (!VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` },
        { status: 400 }
      )
    }

    if (action === 'REJECT' && !reviewNote) {
      return NextResponse.json({ error: 'reviewNote is required when rejecting a company' }, { status: 400 })
    }

    const company = await prisma.companyProfile.findUnique({
      where: { id },
      select: {
        id: true,
        companyName: true,
        verificationStatus: true,
        countryCode: true,
      },
    })
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (!assertCrmCountryAllowed(security, company.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await transitionCompanyVerification(prisma, {
      companyId: id,
      action: action as (typeof VALID_ACTIONS)[number],
      reviewNote,
      reviewedBy: security.adminId,
      actorId: security.adminId,
      actorRole: security.role,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const updated = await prisma.companyProfile.findUnique({
      where: { id },
      select: {
        id: true,
        companyName: true,
        verificationStatus: true,
        isVerified: true,
        verifiedAt: true,
      },
    })

    return NextResponse.json({
      company: updated,
      message: `Company verification ${action.toLowerCase()} completed successfully`,
    })
  } catch (error) {
    console.error('CRM company verification error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
