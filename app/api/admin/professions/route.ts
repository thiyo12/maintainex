import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateStaffRequest } from '@/lib/auth/staff-sessions'
import { ROLE_PERMISSIONS } from '@/lib/admin-types'
import { createProfession, listActiveProfessions } from '@/lib/profession'

// GET: List all professions (active + inactive for admin)
export async function GET(request: NextRequest) {
  try {
    const principal = await authenticateStaffRequest(request)
    if (!principal) {
      return NextResponse.json({ error: 'Invalid or revoked staff session' }, { status: 401 })
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: principal.adminUserId },
      select: { id: true, role: true, isActive: true, deletedAt: true },
    })
    if (!adminUser || !adminUser.isActive || adminUser.deletedAt) {
      return NextResponse.json({ error: 'Invalid or revoked staff session' }, { status: 401 })
    }

    const permissions = ROLE_PERMISSIONS[adminUser.role as keyof typeof ROLE_PERMISSIONS]
    if (!permissions?.includes('professions:read')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const professions = await prisma.profession.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        skills: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, slug: true, i18nKey: true, isActive: true },
        },
        _count: {
          select: {
            taskerProfessions: true,
            companyProfessions: true,
            serviceRequirements: true,
          },
        },
      },
    })

    return NextResponse.json({ professions })
  } catch (error) {
    console.error('Admin professions list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST: Create a new profession
export async function POST(request: NextRequest) {
  try {
    const principal = await authenticateStaffRequest(request)
    if (!principal) {
      return NextResponse.json({ error: 'Invalid or revoked staff session' }, { status: 401 })
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: principal.adminUserId },
      select: { id: true, role: true, isActive: true, deletedAt: true },
    })
    if (!adminUser || !adminUser.isActive || adminUser.deletedAt) {
      return NextResponse.json({ error: 'Invalid or revoked staff session' }, { status: 401 })
    }

    const permissions = ROLE_PERMISSIONS[adminUser.role as keyof typeof ROLE_PERMISSIONS]
    if (!permissions?.includes('professions:write')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { slug, i18nKey, description, sortOrder } = body
    if (!slug || !i18nKey) {
      return NextResponse.json({ error: 'slug and i18nKey required' }, { status: 400 })
    }

    const profession = await createProfession(prisma, {
      slug,
      i18nKey,
      description,
      sortOrder,
    })

    return NextResponse.json({ profession }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Profession with this slug or i18nKey already exists' }, { status: 409 })
    }
    console.error('Admin profession create error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
