import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateStaffRequest } from '@/lib/auth/staff-sessions'
import { ROLE_PERMISSIONS } from '@/lib/admin-types'
import { updateProfession, deactivateProfession } from '@/lib/profession'

// GET: Get single profession with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const profession = await prisma.profession.findUnique({
      where: { id },
      include: {
        skills: { orderBy: { sortOrder: 'asc' } },
        serviceRequirements: {
          include: {
            skillRequirements: {
              include: { professionSkill: { select: { id: true, slug: true, i18nKey: true } } },
            },
          },
        },
        _count: {
          select: { taskerProfessions: true, companyProfessions: true },
        },
      },
    })
    if (!profession) {
      return NextResponse.json({ error: 'Profession not found' }, { status: 404 })
    }

    return NextResponse.json({ profession })
  } catch (error) {
    console.error('Admin profession get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH: Update profession
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const { slug, i18nKey, description, isActive, sortOrder } = body

    const profession = await updateProfession(prisma, id, {
      slug, i18nKey, description, isActive, sortOrder,
    })

    return NextResponse.json({ profession })
  } catch (error) {
    console.error('Admin profession update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE: Deactivate profession (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    await deactivateProfession(prisma, id)
    return NextResponse.json({ message: 'Profession deactivated' })
  } catch (error) {
    console.error('Admin profession deactivate error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
