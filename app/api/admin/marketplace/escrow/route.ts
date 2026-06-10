import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const skip = (page - 1) * limit
  const status = searchParams.get('status') || ''

  const where: any = {}
  if (status) where.status = status

  try {
    const [escrows, total] = await Promise.all([
      prisma.jobEscrow.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.jobEscrow.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: escrows.map((e) => ({
        ...e,
        heldAt: e.heldAt?.toISOString() || null,
        releasedAt: e.releasedAt?.toISOString() || null,
        refundedAt: e.refundedAt?.toISOString() || null,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Escrow list error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch escrows' },
      { status: 500 },
    )
  }
}
