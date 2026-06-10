import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MODERATOR']

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const categories = await prisma.jobCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    console.error('Categories error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!ALLOWED_ROLES.includes(session.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, iconName, colorHex, sortOrder, countries } = body

    if (!name || !iconName || !colorHex) {
      return NextResponse.json(
        { success: false, error: 'Name, iconName, and colorHex required' },
        { status: 400 },
      )
    }

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    const existing = await prisma.jobCategory.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Category already exists' },
        { status: 409 },
      )
    }

    const category = await prisma.jobCategory.create({
      data: {
        name,
        iconName,
        colorHex,
        sortOrder: sortOrder || 0,
        countries: countries || [],
      },
    })

    await prisma.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: 'CREATE',
        targetTable: 'JobCategory',
        targetId: category.id,
        targetLabel: name,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
      },
    })

    return NextResponse.json({ success: true, data: category })
  } catch (error) {
    console.error('Category create error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create category' },
      { status: 500 },
    )
  }
}
