import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateStaffRequest } from '@/lib/auth/staff-sessions'
import { getCountryFilter } from '@/lib/admin-rbac'
import { transitionCompanyVerification } from '@/lib/phase6/kyc-writer'
import { ROLE_PERMISSIONS } from '@/lib/admin-types'

const VALID_ACTIONS = ['SUBMIT', 'APPROVE', 'REJECT', 'SUSPEND'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const principal = await authenticateStaffRequest(request)
    if (!principal) {
      return NextResponse.json({ error: 'Invalid or revoked staff session' }, { status: 401 })
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: principal.adminUserId },
      select: { id: true, role: true, isActive: true, deletedAt: true },
    })
    if (!adminUser || !adminUser.isActive || adminUser.deletedAt) {
      return NextResponse.json({ error: 'Invalid or revoked staff session' }, { status: 401 })
    }

    const permissions = ROLE_PERMISSIONS[adminUser.role as keyof typeof ROLE_PERMISSIONS]
    if (!permissions?.includes('companies:verify')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const companyId = id
    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 })
    }

    const body = await request.json()
    const { action, reviewNote } = body

    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 })
    }

    const company = await prisma.companyProfile.findUnique({
      where: { id: companyId },
      select: { id: true, companyName: true, verificationStatus: true, countryCode: true },
    })
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (adminUser.role !== 'SUPER_ADMIN') {
      const adminSession = { role: adminUser.role, assignedCountries: (principal as any).assignedCountries || [] }
      const countryFilter = getCountryFilter(adminSession as any)
      if (countryFilter.id === '__NONE__') {
        return NextResponse.json({ error: 'No country assigned' }, { status: 403 })
      }
      if (countryFilter.countryCode && !countryFilter.countryCode.in?.includes(company.countryCode || 'LK')) {
        return NextResponse.json({ error: 'Forbidden: company belongs to a different country' }, { status: 403 })
      }
    }

    const result = await transitionCompanyVerification(prisma, {
      companyId,
      action,
      reviewNote: reviewNote || undefined,
      reviewedBy: principal.adminUserId,
      actorId: principal.adminUserId,
      actorRole: adminUser.role,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const updated = await prisma.companyProfile.findUnique({
      where: { id: companyId },
      select: { id: true, companyName: true, verificationStatus: true, isVerified: true, verifiedAt: true },
    })

    return NextResponse.json({
      company: updated,
      message: `Company verification ${action.toLowerCase()}ed successfully`,
    })
  } catch (error) {
    console.error('Company verification error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
