import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  guardCrmRequest,
} from '@/lib/crm/security'
import { evaluateEffectivePermission } from '@/lib/crm/governance'
import { transitionUserKyc } from '@/lib/phase6/kyc-writer'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'kyc:view',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const status = typeof body.status === 'string' ? body.status.toUpperCase() : ''
    const reviewNote =
      typeof body.reviewNote === 'string'
        ? body.reviewNote.trim().slice(0, 2000)
        : undefined

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Status must be APPROVED or REJECTED' }, { status: 400 })
    }

    const requiredPermission = status === 'APPROVED' ? 'kyc:approve' : 'kyc:reject'
    if (!evaluateEffectivePermission({
      role: security.role,
      permission: requiredPermission,
      overrides: security.permissionOverrides,
    }).allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (status === 'REJECTED' && !reviewNote) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }

    const doc = await prisma.identityDocument.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        countryCode: true,
      },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, doc.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (doc.status !== 'PENDING') {
      return NextResponse.json({ error: 'Document already reviewed' }, { status: 409 })
    }

    const action = status === 'APPROVED' ? 'APPROVE' : 'REJECT'
    const result = await transitionUserKyc(prisma, {
      userId: doc.userId,
      action,
      documentId: id,
      reviewNote,
      reviewedBy: security.adminId,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const updated = await prisma.identityDocument.findUnique({ where: { id } })
    return NextResponse.json({ document: updated })
  } catch (error) {
    console.error('Review identity error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
