import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateStaffRequest } from '@/lib/auth/staff-sessions'
import { ROLE_PERMISSIONS } from '@/lib/admin-types'
import { reviewProfessionSubmission } from '@/lib/profession'

// PATCH: Review a profession submission
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
    if (!permissions?.includes('professions:write')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { status, canonicalProfessionId, reviewNote } = body
    if (!status || !['APPROVED', 'REJECTED', 'DUPLICATE'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const submission = await reviewProfessionSubmission(prisma, {
      submissionId: id,
      status,
      canonicalProfessionId,
      reviewNote,
      reviewedBy: principal.adminUserId,
    })

    return NextResponse.json({ submission })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('already reviewed')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    console.error('Admin submission review error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
