import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, getIp } from '@/lib/admin-rbac'
import { kycQuerySchema } from '@/lib/admin-schemas'

export async function GET(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const { searchParams } = request.nextUrl
    const query = kycQuerySchema.parse({
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 25,
      status: searchParams.get('status') || 'PENDING',
    })

    const where: any = { status: query.status }
    const skip = (query.page - 1) * query.limit

    const [docs, total] = await Promise.all([
      prisma.identityDocument.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.identityDocument.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: docs.map((d) => ({
        id: d.id,
        userId: d.userId,
        userName: d.user.name,
        userEmail: d.user.email,
        docType: d.docType,
        side: d.side,
        imageUrl: d.imageUrl,
        status: d.status,
        reviewNote: d.reviewNote,
        reviewedBy: d.reviewedBy,
        reviewedAt: d.reviewedAt?.toISOString() || null,
        createdAt: d.createdAt.toISOString(),
      })),
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    })
  } catch (e) {
    console.error('KYC list error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch KYC documents' }, { status: 500 })
  }
}
