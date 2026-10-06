import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCrmCountryFilter, guardCrmRequest } from '@/lib/crm/security'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'users:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') || 'CUSTOMER'
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 100)
    const search = searchParams.get('search') || ''

    const where: any = {
      ...getCrmCountryFilter(guard.context),
      role,
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: { bookings: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        _count: user._count,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    secureConsole.error('Users API error:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
