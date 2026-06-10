import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const status = request.nextUrl.searchParams.get('status') || 'PENDING'
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20')))
  const skip = (page - 1) * limit

  try {
    const where: any = { status }
    const [docs, total] = await Promise.all([
      prisma.identityDocument.findMany({
        where,
        skip,
        take: limit,
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
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('KYC list error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch KYC documents' },
      { status: 500 },
    )
  }
}
