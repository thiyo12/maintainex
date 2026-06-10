import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MODERATOR']

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!ALLOWED_ROLES.includes(session.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { action, reason } = body

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "approve" or "reject"' },
        { status: 400 },
      )
    }

    const doc = await prisma.identityDocument.findUnique({
      where: { id: params.id },
      include: { user: true },
    })

    if (!doc) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 },
      )
    }

    if (doc.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'Document already reviewed' },
        { status: 400 },
      )
    }

    const updates: any = {
      status: action === 'approve' ? 'APPROVED' : 'REJECTED',
      reviewedBy: session.id,
      reviewedAt: new Date(),
      reviewNote: reason || null,
    }

    await prisma.identityDocument.update({
      where: { id: params.id },
      data: updates,
    })

    if (action === 'approve') {
      const allDocsForUser = await prisma.identityDocument.findMany({
        where: { userId: doc.userId, status: { not: 'APPROVED' } },
      })
      if (allDocsForUser.length === 0) {
        await prisma.user.update({
          where: { id: doc.userId },
          data: { identityStatus: 'APPROVED' },
        })
      }
    }

    await prisma.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: action === 'approve' ? 'KYC_APPROVE' : 'KYC_REJECT',
        targetTable: 'IdentityDocument',
        targetId: params.id,
        targetLabel: `${doc.user.name} - ${doc.docType}`,
        oldValue: { status: doc.status },
        newValue: updates,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('KYC action error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process KYC' },
      { status: 500 },
    )
  }
}
