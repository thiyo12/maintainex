import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateStaffRequest } from '@/lib/auth/staff-sessions'
import { ROLE_PERMISSIONS } from '@/lib/admin-types'
import { createProfessionSkill, deactivateProfessionSkill } from '@/lib/profession'

// GET: List skills for a profession (admin)
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

    const skills = await prisma.professionSkill.findMany({
      where: { professionId: id },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { taskerSkills: true, companySkills: true } } },
    })

    return NextResponse.json({ skills })
  } catch (error) {
    console.error('Admin profession skills error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST: Add a skill to a profession
export async function POST(
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
    const { slug, i18nKey, description, sortOrder } = body
    if (!slug || !i18nKey) {
      return NextResponse.json({ error: 'slug and i18nKey required' }, { status: 400 })
    }

    const skill = await createProfessionSkill(prisma, {
      professionId: id,
      slug,
      i18nKey,
      description,
      sortOrder,
    })

    return NextResponse.json({ skill }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Skill with this slug already exists in this profession' }, { status: 409 })
    }
    console.error('Admin profession skill create error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE: Deactivate a skill
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

    const body = await request.json().catch(() => ({}))
    const { skillId } = body as { skillId?: string }
    if (!skillId) {
      return NextResponse.json({ error: 'skillId required' }, { status: 400 })
    }

    await deactivateProfessionSkill(prisma, skillId)
    return NextResponse.json({ message: 'Skill deactivated' })
  } catch (error) {
    console.error('Admin profession skill deactivate error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
