import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest, type CrmSecurityContext } from '@/lib/crm/security'
import { evaluateEffectivePermission, getPermissionCatalogEntry } from '@/lib/crm/governance'
import { createAuditLog } from '@/lib/crm/audit'
import { createProfession } from '@/lib/profession'

function canPublishCatalog(security: CrmSecurityContext): boolean {
  const entry = getPermissionCatalogEntry('catalog:publish')
  return evaluateEffectivePermission({
    role: security.role,
    permission: 'catalog:publish',
    permissionClass: entry?.class,
    overrides: security.permissionOverrides,
  }).allowed
}

function cleanSlug(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 120)
    : ''
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'catalog:view',
      level: 'read',
    })
    if (!guard.ok) return guard.response

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

    return NextResponse.json(
      { professions },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    secureConsole.error('CRM professions list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'catalog:edit',
      level: 'sensitive',
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const slug = cleanSlug(body?.slug)
    const i18nKey = typeof body?.i18nKey === 'string' ? body.i18nKey.trim().slice(0, 200) : ''
    const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 2000) : undefined
    const sortOrder = body?.sortOrder === undefined ? 0 : Number(body.sortOrder)
    const requestedActive = body?.isActive === true

    if (requestedActive && !canPublishCatalog(security)) {
      return NextResponse.json(
        { error: 'catalog:publish is required to create an active profession' },
        { status: 403 }
      )
    }

    if (!slug || !i18nKey) {
      return NextResponse.json({ error: 'slug and i18nKey required' }, { status: 400 })
    }
    if (!Number.isInteger(sortOrder) || sortOrder < -100000 || sortOrder > 100000) {
      return NextResponse.json({ error: 'Invalid sortOrder' }, { status: 400 })
    }

    const profession = await createProfession(prisma, {
      slug,
      i18nKey,
      description,
      sortOrder,
      isActive: requestedActive,
    })

    await createAuditLog({
      action: 'CREATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'Profession',
      entityId: profession.id,
      entityName: profession.slug,
      description: 'CRM profession created',
      newValue: profession,
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ profession }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Profession with this slug or i18nKey already exists' }, { status: 409 })
    }
    secureConsole.error('CRM profession create error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
