import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { ROLE_PERMISSIONS } from '@/lib/admin-types'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'USER_MANAGEMENT', 'MANAGER', 'FINANCE']

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = ROLE_PERMISSIONS[session.role as keyof typeof ROLE_PERMISSIONS]
    if (!permissions?.includes('credentials:read')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'PENDING'
    const holderType = searchParams.get('holderType')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}
    if (status && status !== 'ALL') where.verificationStatus = status
    if (holderType) where.holderType = holderType

    const [credentials, total] = await Promise.all([
      prisma.certification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.certification.count({ where }),
    ])

    return NextResponse.json({
      credentials,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('Credentials GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
