import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { transitionCompanyVerification } from '@/lib/phase6/kyc-writer'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'MANAGER', 'USER_MANAGEMENT']

const VALID_ACTIONS = ['SUBMIT', 'APPROVE', 'REJECT', 'SUSPEND'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyId = params.id
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
      select: { id: true, companyName: true, verificationStatus: true },
    })
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const result = await transitionCompanyVerification(prisma, {
      companyId,
      action,
      reviewNote: reviewNote || undefined,
      reviewedBy: session.adminUserId,
      actorId: session.adminUserId,
      actorRole: session.role,
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
