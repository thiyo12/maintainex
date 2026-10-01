import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmAction, guardCrmRequest } from '@/lib/crm/security'
import {
  canDelegatePermissionClass,
  evaluateEffectivePermission,
  getPermissionCatalog,
  getPermissionCatalogEntry,
  validatePermissionOverrides,
  type PermissionOverride,
} from '@/lib/crm/governance'

function safeAdminSelect() {
  return {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    isActive: true,
    deletedAt: true,
    assignedCountries: true,
  } as const
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id || id.length > 128) {
      return NextResponse.json({ error: 'Invalid staff ID' }, { status: 400 })
    }

    const guard = await guardCrmRequest(request, {
      permission: 'admins:view',
      level: 'read',
    })
    if (!guard.ok) return guard.response

    const [staff, overrides] = await Promise.all([
      prisma.adminUser.findUnique({ where: { id }, select: safeAdminSelect() }),
      prisma.adminPermissionOverride.findMany({
        where: { adminUserId: id },
        select: { permission: true, effect: true, createdBy: true, createdAt: true, updatedAt: true },
        orderBy: { permission: 'asc' },
      }),
    ])

    if (!staff || staff.deletedAt) {
      return NextResponse.json({ error: 'Staff account not found' }, { status: 404 })
    }

    const catalog = getPermissionCatalog()
    const normalizedOverrides: PermissionOverride[] = overrides
      .filter(item => item.effect === 'ALLOW' || item.effect === 'DENY')
      .map(item => ({ permission: item.permission, effect: item.effect as PermissionOverride['effect'] }))

    const permissions = catalog.map(entry => {
      const effective = evaluateEffectivePermission({
        role: staff.role as any,
        permission: entry.id,
        permissionClass: entry.class,
        overrides: normalizedOverrides,
      })
      return {
        permission: entry.id,
        class: entry.class,
        allowed: effective.allowed,
        source: effective.source,
      }
    })

    return NextResponse.json(
      {
        staff,
        overrides,
        permissions,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM staff permission GET error:', error)
    return NextResponse.json({ error: 'Failed to load staff permissions' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id || id.length > 128) {
      return NextResponse.json({ error: 'Invalid staff ID' }, { status: 400 })
    }

    const guard = await guardCrmAction(request, 'staff.permission.change')
    if (!guard.ok) return guard.response
    const security = guard.context

    if (id === security.adminId) {
      return NextResponse.json(
        { error: 'You cannot change your own permission overrides.' },
        { status: 409 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const overrides: PermissionOverride[] = Array.isArray(body?.overrides)
      ? body.overrides
          .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
          .map((item: Record<string, unknown>) => ({
            permission: typeof item.permission === 'string' ? item.permission.trim() : '',
            effect: item.effect === 'ALLOW' ? 'ALLOW' : item.effect === 'DENY' ? 'DENY' : '' as any,
          }))
      : []

    if (overrides.length > 250) {
      return NextResponse.json({ error: 'Too many permission overrides' }, { status: 400 })
    }

    const validation = validatePermissionOverrides(overrides)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.reason }, { status: 400 })
    }

    const target = await prisma.adminUser.findUnique({
      where: { id },
      select: safeAdminSelect(),
    })
    if (!target || target.deletedAt) {
      return NextResponse.json({ error: 'Staff account not found' }, { status: 404 })
    }

    if (target.role === 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'SUPER_ADMIN permissions are governed by the owner role and cannot be overridden here.' },
        { status: 409 }
      )
    }

    for (const override of overrides) {
      const entry = getPermissionCatalogEntry(override.permission)
      if (!entry) {
        return NextResponse.json(
          { error: `Unknown permission: ${override.permission}` },
          { status: 400 }
        )
      }
      if (override.effect === 'ALLOW' && !canDelegatePermissionClass(security.role, entry.class)) {
        return NextResponse.json(
          { error: `Permission cannot be delegated: ${override.permission}` },
          { status: 403 }
        )
      }
      if (entry.class === 'SYSTEM_ONLY' || entry.class === 'OWNER_ONLY') {
        return NextResponse.json(
          { error: `Permission cannot be overridden: ${override.permission}` },
          { status: 403 }
        )
      }
    }

    const previous = await prisma.adminPermissionOverride.findMany({
      where: { adminUserId: id },
      select: { permission: true, effect: true },
      orderBy: { permission: 'asc' },
    })

    await prisma.$transaction(async tx => {
      await tx.adminPermissionOverride.deleteMany({ where: { adminUserId: id } })
      if (overrides.length > 0) {
        await tx.adminPermissionOverride.createMany({
          data: overrides.map(override => ({
            adminUserId: id,
            permission: override.permission,
            effect: override.effect,
            createdBy: security.adminId,
          })),
        })
      }

      // Privilege changes are fail-closed on audit: a failed audit insert
      // rolls back the permission mutation in this same transaction.
      await tx.securityAudit.create({
        data: {
          action: 'UPDATE',
          category: 'ADMIN',
          userId: security.adminId,
          userEmail: security.email,
          userRole: security.role,
          entityType: 'AdminPermissionOverride',
          entityId: id,
          entityName: `${target.firstName} ${target.lastName}`,
          description: 'CRM staff permission overrides replaced',
          oldValue: JSON.stringify({ overrides: previous }),
          newValue: JSON.stringify({ overrides }),
          ipAddress: security.ipAddress,
          userAgent: security.userAgent || undefined,
          riskLevel: 'CRITICAL',
          isSuspicious: true,
        },
      })
    })

    return NextResponse.json({
      success: true,
      staffId: id,
      overrides,
    })
  } catch (error) {
    console.error('CRM staff permission PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update staff permissions' }, { status: 500 })
  }
}
