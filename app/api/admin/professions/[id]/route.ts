import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'
import { updateProfession, deactivateProfession } from '@/lib/profession'
import type { ProfessionUpdateInput } from '@/lib/profession/types'

function cleanSlug(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 120)
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

    const profession = await prisma.profession.findUnique({
      where: { id },
      include: {
        skills: { orderBy: { sortOrder: 'asc' } },
        serviceRequirements: {
          include: {
            skillRequirements: {
              include: {
                professionSkill: { select: { id: true, slug: true, i18nKey: true } },
              },
            },
          },
        },
        _count: {
          select: { taskerProfessions: true, companyProfessions: true },
        },
      },
    })
    if (!profession) return NextResponse.json({ error: 'Profession not found' }, { status: 404 })

    return NextResponse.json(
      { profession },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM profession get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
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
    if (!id || id.length > 128) return NextResponse.json({ error: 'Invalid profession ID' }, { status: 400 })

    const existing = await prisma.profession.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Profession not found' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const data: ProfessionUpdateInput = {}
    const slug = cleanSlug(body?.slug)
    if (slug !== undefined) {
      if (!slug) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
      data.slug = slug
    }
    if (body?.i18nKey !== undefined) {
      const key = typeof body.i18nKey === 'string' ? body.i18nKey.trim().slice(0, 200) : ''
      if (!key) return NextResponse.json({ error: 'Invalid i18nKey' }, { status: 400 })
      data.i18nKey = key
    }
    if (body?.description !== undefined) {
      data.description = typeof body.description === 'string' && body.description.trim()
        ? body.description.trim().slice(0, 2000)
        : null
    }
    if (body?.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') return NextResponse.json({ error: 'isActive must be boolean' }, { status: 400 })
      data.isActive = body.isActive
    }
    if (body?.sortOrder !== undefined) {
      const sortOrder = Number(body.sortOrder)
      if (!Number.isInteger(sortOrder) || sortOrder < -100000 || sortOrder > 100000) {
        return NextResponse.json({ error: 'Invalid sortOrder' }, { status: 400 })
      }
      data.sortOrder = sortOrder
    }
    if (!Object.keys(data).length) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })

    const profession = await updateProfession(prisma, id, data)

    await createAuditLog({
      action: 'UPDATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'Profession',
      entityId: id,
      entityName: existing.slug,
      description: 'CRM profession updated',
      oldValue: existing,
      newValue: profession,
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ profession })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('Unique constraint')) return NextResponse.json({ error: 'Profession slug or i18nKey already exists' }, { status: 409 })
    console.error('CRM profession update error:', error)
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
    const existing = await prisma.profession.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Profession not found' }, { status: 404 })

    const profession = await deactivateProfession(prisma, id)

    await createAuditLog({
      action: 'UPDATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'Profession',
      entityId: id,
      entityName: existing.slug,
      description: 'CRM profession deactivated',
      oldValue: { isActive: existing.isActive },
      newValue: { isActive: profession.isActive },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ message: 'Profession deactivated', profession })
  } catch (error) {
    console.error('CRM profession deactivate error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
