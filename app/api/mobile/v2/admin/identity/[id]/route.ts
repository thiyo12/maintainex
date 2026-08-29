import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
      where: { id: params.id },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (doc.status !== 'PENDING') {
      return NextResponse.json({ error: 'Document already reviewed' }, { status: 400 })
    }

    const updated = await prisma.identityDocument.update({
      where: { id: params.id },
      data: {
        status,
        reviewNote: reviewNote || null,
        reviewedBy: user.id,
        reviewedAt: new Date(),
      },
    })

    if (status === 'APPROVED') {
      const allDocs = await prisma.identityDocument.findMany({
        where: { userId: doc.userId, status: 'APPROVED' },
      })
      if (allDocs.length >= 1) {
        await prisma.user.update({
          where: { id: doc.userId },
          data: { identityStatus: 'APPROVED' },
        })
      }
    }

    return NextResponse.json({ document: updated })
  } catch (error) {
    console.error('Review identity error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
