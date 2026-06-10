import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, getCountryFilter, getIp } from '@/lib/admin-rbac'
import { userQuerySchema } from '@/lib/admin-schemas'

export async function GET(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const { searchParams } = request.nextUrl
    const query = userQuerySchema.parse({
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 25,
      search: searchParams.get('search') || undefined,
      role: searchParams.get('role') || undefined,
      country: searchParams.get('country') || undefined,
      status: searchParams.get('status') || undefined,
      kyc: searchParams.get('kyc') || undefined,
    })

    const where: any = {}
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ]
    }
    if (query.role) where.role = query.role
    if (query.status === 'ACTIVE') where.isActive = true
    if (query.status === 'SUSPENDED' || query.status === 'BANNED') where.isActive = false
    if (query.kyc) where.identityStatus = query.kyc

    if (session.role === 'ADMIN') {
      const countryFilter = getCountryFilter(session)
      if (countryFilter.id === '__NONE__') {
        return NextResponse.json({ success: true, data: [], meta: { total: 0, page: query.page, limit: query.limit, totalPages: 0 } })
      }
    }

    const skip = (query.page - 1) * query.limit
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          identityStatus: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    })
  } catch (e) {
    console.error('Users list error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 })
  }
}
