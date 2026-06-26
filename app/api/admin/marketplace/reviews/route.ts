import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, createAuditLog } from '@/lib/admin-rbac'

export async function GET(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {}
    if (status) where.status = status

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          service: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: reviews.map((r) => ({
        id: r.id,
        userId: r.userId,
        user: r.user,
        service: r.service,
        rating: r.rating,
        comment: r.comment,
        status: r.status,
        customerName: r.customerName,
        createdAt: r.createdAt.toISOString(),
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (e) {
    console.error('Reviews error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch reviews' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!

  try {
    const { id, action } = await request.json()
    if (!id || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
    }

    const review = await prisma.review.findUnique({ where: { id } })
    if (!review) {
      return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 })
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'

    await prisma.review.update({
      where: { id },
      data: { status: newStatus },
    })

    await createAuditLog({
      session,
      action: 'UPDATE',
      targetTable: 'Review',
      targetId: id,
      targetLabel: `Review ${id}`,
      oldValue: { status: review.status },
      newValue: { status: newStatus },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    })

    return NextResponse.json({ success: true, status: newStatus })
  } catch (e) {
    console.error('Review update error:', e)
    return NextResponse.json({ success: false, error: 'Failed to update review' }, { status: 500 })
  }
}
