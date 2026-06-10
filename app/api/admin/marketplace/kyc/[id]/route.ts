import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, createAuditLog, getIp } from '@/lib/admin-rbac'
import { z } from 'zod'

const kycActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const body = await request.json()
    const { action, reason } = kycActionSchema.parse(body)

    const doc = await prisma.identityDocument.findUnique({
      where: { id: params.id },
      include: { user: true },
    })

    if (!doc) {
      return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 })
    }

    if (doc.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Document already reviewed' }, { status: 400 })
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
      const remainingPending = await prisma.identityDocument.count({
        where: { userId: doc.userId, status: { not: 'APPROVED' } },
      })
      if (remainingPending === 0) {
        await prisma.user.update({
          where: { id: doc.userId },
          data: { identityStatus: 'APPROVED' },
        })
      }
    }

    await createAuditLog({
      session,
      action: action === 'approve' ? 'KYC_APPROVE' : 'KYC_REJECT',
      targetTable: 'IdentityDocument',
      targetId: params.id,
      targetLabel: `${doc.user.name} - ${doc.docType}`,
      oldValue: JSON.parse(JSON.stringify({ status: doc.status })),
      newValue: JSON.parse(JSON.stringify(updates)),
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('KYC action error:', e)
    return NextResponse.json({ success: false, error: 'Failed to process KYC' }, { status: 500 })
  }
}
