import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, getCountryFilter, getIp } from '@/lib/admin-rbac'
import { jobQuerySchema } from '@/lib/admin-schemas'

export async function GET(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const { searchParams } = request.nextUrl
    const query = jobQuerySchema.parse({
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 25,
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      country: searchParams.get('country') || undefined,
      category: searchParams.get('category') || undefined,
    })

    const where: any = {}
    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' }
    }
    if (query.status) where.status = query.status
    if (query.category) where.categoryId = query.category

    if (session.role === 'ADMIN' && session.assignedCountries.length > 0) {
      const areasInCountries = await prisma.area.findMany({
        where: {
          city: {
            state: {
              country: {
                code: { in: session.assignedCountries },
              },
            },
          },
        },
        select: { id: true },
      })
      const areaIds = areasInCountries.map((a) => a.id)
      where.areaId = areaIds.length > 0 ? { in: areaIds } : null
      if (areaIds.length === 0) {
        return NextResponse.json({ success: true, data: [], meta: { total: 0, page: query.page, limit: query.limit, totalPages: 0 } })
      }
    }

    const skip = (query.page - 1) * query.limit
    const [jobs, total] = await Promise.all([
      prisma.marketplaceJob.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          budgetType: true,
          budgetAmount: true,
          status: true,
          isActive: true,
          categoryId: true,
          areaId: true,
          createdAt: true,
        },
      }),
      prisma.marketplaceJob.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: jobs.map((j) => ({ ...j, createdAt: j.createdAt.toISOString() })),
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    })
  } catch (e) {
    console.error('Jobs list error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch jobs' }, { status: 500 })
  }
}
