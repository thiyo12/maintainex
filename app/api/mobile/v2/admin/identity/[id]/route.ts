import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import { transitionUserKyc } from '@/lib/phase6/kyc-writer'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user || !['SUPER_ADMIN', 'MANAGER', 'FINANCE'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { status, reviewNote } = body

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Status must be APPROVED or REJECTED' }, { status: 400 })
    }

    const doc = await prisma.identityDocument.findUnique({
      where: { id },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (doc.status !== 'PENDING') {
      return NextResponse.json({ error: 'Document already reviewed' }, { status: 400 })
    }

    const action = status === 'APPROVED' ? 'APPROVE' : 'REJECT'
    const result = await transitionUserKyc(prisma, {
      userId: doc.userId,
      action,
      documentId: id,
      reviewNote: reviewNote || undefined,
      reviewedBy: user.id,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const updated = await prisma.identityDocument.findUnique({
      where: { id },
    })

    return NextResponse.json({ document: updated })
  } catch (error) {
    console.error('Review identity error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
