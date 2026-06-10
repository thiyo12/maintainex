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
  const search = searchParams.get('search') || ''

  const where: any = {}
  if (status) where.status = status
  if (search) where.title = { contains: search, mode: 'insensitive' }

  try {
    const [jobs, total] = await Promise.all([
      prisma.marketplaceJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          budgetType: true,
          budgetAmount: true,
          status: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.marketplaceJob.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: jobs.map((j) => ({ ...j, createdAt: j.createdAt.toISOString() })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Jobs list error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch jobs' },
      { status: 500 },
    )
  }
}
