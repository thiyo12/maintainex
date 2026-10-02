import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'
import { reviewProfessionSubmission } from '@/lib/profession'

const VALID_STATUS = new Set(['APPROVED', 'REJECTED', 'DUPLICATE'])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'catalog:publish',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    if (!id || id.length > 128) return NextResponse.json({ error: 'Invalid submission ID' }, { status: 400 })

    const existing = await prisma.professionSubmission.findUnique({
      where: { id },
      select: {
        id: true,
        submittedById: true,
        requestedName: true,
        status: true,
        canonicalProfessionId: true,
        reviewNote: true,
      },
    })
    if (!existing) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })

    const submitter = await prisma.user.findUnique({
      where: { id: existing.submittedById },
      select: { id: true, countryCode: true },
    })
    if (!submitter) return NextResponse.json({ error: 'Submission owner not found' }, { status: 404 })
    if (!assertCrmCountryAllowed(security, submitter.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const status = typeof body?.status === 'string' ? body.status.toUpperCase() : ''
    const canonicalProfessionId = typeof body?.canonicalProfessionId === 'string' && body.canonicalProfessionId.trim()
      ? body.canonicalProfessionId.trim().slice(0, 128)
      : undefined
    const reviewNote = typeof body?.reviewNote === 'string' && body.reviewNote.trim()
      ? body.reviewNote.trim().slice(0, 2000)
      : undefined

    if (!VALID_STATUS.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    if ((status === 'APPROVED' || status === 'DUPLICATE') && !canonicalProfessionId) {
      return NextResponse.json({ error: 'canonicalProfessionId is required for APPROVED/DUPLICATE' }, { status: 400 })
    }
    if (status === 'REJECTED' && !reviewNote) {
      return NextResponse.json({ error: 'reviewNote is required for rejection' }, { status: 400 })
    }
    if (canonicalProfessionId) {
      const canonical = await prisma.profession.findUnique({
        where: { id: canonicalProfessionId },
        select: { id: true, isActive: true },
      })
      if (!canonical || !canonical.isActive) {
        return NextResponse.json({ error: 'Canonical profession must exist and be active' }, { status: 400 })
      }
    }

    const reviewed = await reviewProfessionSubmission(prisma, {
      submissionId: id,
      status: status as 'APPROVED' | 'REJECTED' | 'DUPLICATE',
      canonicalProfessionId,
      reviewNote,
      reviewedBy: security.adminId,
    })

    await createAuditLog({
      action: 'UPDATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'ProfessionSubmission',
      entityId: id,
      entityName: existing.requestedName,
      description: `CRM profession submission reviewed: ${status}`,
      oldValue: {
        status: existing.status,
        canonicalProfessionId: existing.canonicalProfessionId,
        reviewNote: existing.reviewNote,
      },
      newValue: {
        status: reviewed.status,
        canonicalProfessionId: reviewed.canonicalProfessionId,
        reviewNote: reviewed.reviewNote,
      },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: status === 'REJECTED' ? 'MEDIUM' : 'LOW',
    })

    return NextResponse.json({ submission: reviewed })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('already reviewed') || message.includes('Self-review prohibited')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    console.error('CRM profession submission review error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
