import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, createAuditLog, getIp } from '@/lib/admin-rbac'
import { createCategorySchema } from '@/lib/admin-schemas'

export async function GET(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const categories = await prisma.jobCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json({ success: true, data: categories })
  } catch (e) {
    console.error('Categories error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const body = await request.json()
    const data = createCategorySchema.parse(body)

    const slug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    const existing = await prisma.jobCategory.findUnique({ where: { name: data.name } })
    if (existing) {
      return NextResponse.json({ success: false, error: 'Category already exists' }, { status: 409 })
    }

    const category = await prisma.jobCategory.create({
      data: {
        name: data.name,
        iconName: data.icon || 'Folder',
        colorHex: data.color || '#6366f1',
        sortOrder: data.sortOrder ?? 0,
        countries: data.countries || [],
      },
    })

    await createAuditLog({
      session,
      action: 'CREATE',
      targetTable: 'JobCategory',
      targetId: category.id,
      targetLabel: data.name,
      oldValue: null,
      newValue: JSON.parse(JSON.stringify(category)),
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({ success: true, data: category })
  } catch (e) {
    console.error('Category create error:', e)
    return NextResponse.json({ success: false, error: 'Failed to create category' }, { status: 500 })
  }
}
