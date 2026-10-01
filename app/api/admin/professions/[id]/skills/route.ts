import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'
import { createProfessionSkill, deactivateProfessionSkill } from '@/lib/profession'

function cleanSlug(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 120)
    : ''
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'professions:read',
      level: 'read',
    })
    if (!guard.ok) return guard.response

    const { id } = await params
    if (!id || id.length > 128) return NextResponse.json({ error: 'Invalid profession ID' }, { status: 400 })

    const profession = await prisma.profession.findUnique({ where: { id }, select: { id: true } })
    if (!profession) return NextResponse.json({ error: 'Profession not found' }, { status: 404 })

    const skills = await prisma.professionSkill.findMany({
      where: { professionId: id },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { taskerSkills: true, companySkills: true } } },
    })

    return NextResponse.json(
      { skills },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM profession skills GET error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'professions:write',
      level: 'sensitive',
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    const profession = await prisma.profession.findUnique({ where: { id }, select: { id: true, slug: true, isActive: true } })
    if (!profession) return NextResponse.json({ error: 'Profession not found' }, { status: 404 })
    if (!profession.isActive) return NextResponse.json({ error: 'Cannot add a skill to an inactive profession' }, { status: 409 })

    const body = await request.json().catch(() => ({}))
    const slug = cleanSlug(body?.slug)
    const i18nKey = typeof body?.i18nKey === 'string' ? body.i18nKey.trim().slice(0, 200) : ''
    const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 2000) : undefined
    const sortOrder = body?.sortOrder === undefined ? 0 : Number(body.sortOrder)

    if (!slug || !i18nKey) return NextResponse.json({ error: 'slug and i18nKey required' }, { status: 400 })
    if (!Number.isInteger(sortOrder) || sortOrder < -100000 || sortOrder > 100000) {
      return NextResponse.json({ error: 'Invalid sortOrder' }, { status: 400 })
    }

    const skill = await createProfessionSkill(prisma, {
      professionId: id,
      slug,
      i18nKey,
      description,
      sortOrder,
    })

    await createAuditLog({
      action: 'CREATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'ProfessionSkill',
      entityId: skill.id,
      entityName: skill.slug,
      description: `CRM profession skill added to ${profession.slug}`,
      newValue: skill,
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ skill }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Skill with this slug already exists in this profession' }, { status: 409 })
    }
    console.error('CRM profession skill create error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'professions:write',
      level: 'sensitive',
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const skillId = typeof body?.skillId === 'string' ? body.skillId.trim().slice(0, 128) : ''
    if (!skillId) return NextResponse.json({ error: 'skillId required' }, { status: 400 })

    const skill = await prisma.professionSkill.findUnique({ where: { id: skillId } })
    if (!skill) return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    if (skill.professionId !== id) {
      return NextResponse.json({ error: 'Skill does not belong to this profession' }, { status: 400 })
    }

    const updated = await deactivateProfessionSkill(prisma, skillId)

    await createAuditLog({
      action: 'UPDATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'ProfessionSkill',
      entityId: skill.id,
      entityName: skill.slug,
      description: 'CRM profession skill deactivated',
      oldValue: { isActive: skill.isActive },
      newValue: { isActive: updated.isActive },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ message: 'Skill deactivated', skill: updated })
  } catch (error) {
    console.error('CRM profession skill deactivate error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
