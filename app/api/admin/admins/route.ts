import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { ADMIN_ROLES, type AdminRole } from '@/lib/admin-types'
import { guardCrmRequest } from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'

const VALID_ROLES = new Set(Object.keys(ADMIN_ROLES))

function normalizeCountries(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(value)
            return Array.isArray(parsed) ? parsed : value.split(',')
          } catch {
            return value.split(',')
          }
        })()
      : []

  return [...new Set(
    raw
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim().toUpperCase())
      .filter(item => /^[A-Z]{2}$/.test(item))
  )].slice(0, 50)
}

function serialiseCountries(value: unknown): string {
  return JSON.stringify(normalizeCountries(value))
}

function safeAdminSelect() {
  return {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    isActive: true,
    lastLoginAt: true,
    createdBy: true,
    assignedCountries: true,
    createdAt: true,
    totpEnabled: true,
    deletedAt: true,
  } as const
}

async function activeSuperAdminCount() {
  return prisma.adminUser.count({
    where: {
      role: 'SUPER_ADMIN',
      isActive: true,
      deletedAt: null,
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'admins:view',
      level: 'read',
    })
    if (!guard.ok) return guard.response

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000)

    const admins = await prisma.adminUser.findMany({
      where: { deletedAt: null },
      select: safeAdminSelect(),
      orderBy: { createdAt: 'desc' },
    })

    const adminIds = admins.map(admin => admin.id)
    const [actionsTodayCounts, lastActiveEntries, creators] = await Promise.all([
      adminIds.length
        ? prisma.auditLog.groupBy({
            by: ['adminUserId'],
            where: {
              adminUserId: { in: adminIds },
              createdAt: { gte: startOfToday },
            },
            _count: { id: true },
          })
        : [],
      adminIds.length
        ? prisma.auditLog.findMany({
            where: { adminUserId: { in: adminIds } },
            select: { adminUserId: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            distinct: ['adminUserId'],
          })
        : [],
      prisma.adminUser.findMany({
        where: {
          id: { in: admins.map(admin => admin.createdBy).filter((id): id is string => Boolean(id)) },
        },
        select: { id: true, firstName: true, lastName: true },
      }),
    ])

    const actionMap = new Map(actionsTodayCounts.map(entry => [entry.adminUserId, entry._count.id]))
    const activeMap = new Map(lastActiveEntries.map(entry => [entry.adminUserId, entry.createdAt]))
    const creatorMap = new Map(creators.map(entry => [entry.id, `${entry.firstName} ${entry.lastName}`]))

    const result = admins.map(admin => {
      const lastActiveAt = activeMap.get(admin.id) ?? null
      return {
        ...admin,
        assignedCountries: normalizeCountries(admin.assignedCountries),
        createdByName: admin.createdBy ? creatorMap.get(admin.createdBy) || null : null,
        actionsToday: actionMap.get(admin.id) ?? 0,
        lastActiveAt,
        isOnline: lastActiveAt !== null && lastActiveAt >= fiveMinAgo,
      }
    })

    return NextResponse.json(
      { admins: result },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM admins GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'admins:create',
      level: 'sensitive',
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const firstName = typeof body?.firstName === 'string' ? body.firstName.trim().slice(0, 80) : ''
    const lastName = typeof body?.lastName === 'string' ? body.lastName.trim().slice(0, 80) : ''
    const role = typeof body?.role === 'string' ? body.role.toUpperCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const assignedCountries = normalizeCountries(body?.assignedCountries)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }
    if (firstName.length < 1 || lastName.length < 1) {
      return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })
    }
    if (!VALID_ROLES.has(role)) {
      return NextResponse.json({ error: 'Invalid admin role' }, { status: 400 })
    }
    if (password.length < 8 || password.length > 200) {
      return NextResponse.json({ error: 'Password must be between 8 and 200 characters' }, { status: 400 })
    }
    if (role !== 'SUPER_ADMIN' && assignedCountries.length === 0) {
      return NextResponse.json({ error: 'At least one country assignment is required' }, { status: 400 })
    }

    const existing = await prisma.adminUser.findUnique({ where: { email } })
    if (existing && !existing.deletedAt) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }

    const passwordHash = await hash(password, 12)

    const admin = existing
      ? await prisma.adminUser.update({
          where: { id: existing.id },
          data: {
            email,
            firstName,
            lastName,
            role: role as AdminRole,
            passwordHash,
            assignedCountries: serialiseCountries(assignedCountries),
            isActive: true,
            deletedAt: null,
            createdBy: security.adminId,
          },
          select: safeAdminSelect(),
        })
      : await prisma.adminUser.create({
          data: {
            email,
            firstName,
            lastName,
            role: role as AdminRole,
            passwordHash,
            assignedCountries: serialiseCountries(assignedCountries),
            isActive: true,
            createdBy: security.adminId,
          },
          select: safeAdminSelect(),
        })

    await createAuditLog({
      action: 'CREATE',
      category: 'ADMIN',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'AdminUser',
      entityId: admin.id,
      entityName: `${admin.firstName} ${admin.lastName}`,
      description: 'CRM staff account created',
      newValue: {
        email: admin.email,
        role: admin.role,
        assignedCountries,
        isActive: admin.isActive,
      },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'HIGH',
    })

    return NextResponse.json({
      admin: {
        ...admin,
        assignedCountries,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('CRM admins POST error:', error)
    return NextResponse.json({ error: 'Failed to create admin' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'admins:edit',
      level: 'sensitive',
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const id = typeof body?.id === 'string' ? body.id : ''
    if (!id || id.length > 128) {
      return NextResponse.json({ error: 'Admin ID required' }, { status: 400 })
    }

    const current = await prisma.adminUser.findUnique({
      where: { id },
      select: safeAdminSelect(),
    })
    if (!current || current.deletedAt) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    let nextRole = current.role
    let nextActive = current.isActive
    let nextCountries = normalizeCountries(current.assignedCountries)

    if (body?.role !== undefined) {
      const role = typeof body.role === 'string' ? body.role.toUpperCase() : ''
      if (!VALID_ROLES.has(role)) {
        return NextResponse.json({ error: 'Invalid admin role' }, { status: 400 })
      }
      nextRole = role as AdminRole
      updateData.role = nextRole
    }

    if (body?.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') {
        return NextResponse.json({ error: 'isActive must be boolean' }, { status: 400 })
      }
      nextActive = body.isActive
      updateData.isActive = nextActive
    }

    if (body?.assignedCountries !== undefined) {
      nextCountries = normalizeCountries(body.assignedCountries)
      updateData.assignedCountries = serialiseCountries(nextCountries)
    }

    if (body?.password !== undefined) {
      if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 200) {
        return NextResponse.json({ error: 'Password must be between 8 and 200 characters' }, { status: 400 })
      }
      updateData.passwordHash = await hash(body.password, 12)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    if (nextRole !== 'SUPER_ADMIN' && nextCountries.length === 0) {
      return NextResponse.json({ error: 'At least one country assignment is required' }, { status: 400 })
    }

    const demotingLastSuperAdmin =
      current.role === 'SUPER_ADMIN' &&
      (nextRole !== 'SUPER_ADMIN' || nextActive === false) &&
      (await activeSuperAdminCount()) <= 1

    if (demotingLastSuperAdmin) {
      return NextResponse.json({ error: 'Cannot remove or deactivate the last active SUPER_ADMIN' }, { status: 409 })
    }

    if (id === security.adminId && nextActive === false) {
      return NextResponse.json({ error: 'You cannot deactivate your own active session account' }, { status: 409 })
    }

    const admin = await prisma.adminUser.update({
      where: { id },
      data: updateData,
      select: safeAdminSelect(),
    })

    if (nextActive === false) {
      await prisma.adminSession.updateMany({
        where: { adminUserId: id, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      })
    }

    await createAuditLog({
      action: 'UPDATE',
      category: 'ADMIN',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'AdminUser',
      entityId: admin.id,
      entityName: `${admin.firstName} ${admin.lastName}`,
      description: 'CRM staff account updated',
      oldValue: {
        role: current.role,
        isActive: current.isActive,
        assignedCountries: normalizeCountries(current.assignedCountries),
      },
      newValue: {
        role: admin.role,
        isActive: admin.isActive,
        assignedCountries: normalizeCountries(admin.assignedCountries),
        passwordChanged: body?.password !== undefined,
      },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'HIGH',
    })

    return NextResponse.json({
      admin: {
        ...admin,
        assignedCountries: normalizeCountries(admin.assignedCountries),
      },
    })
  } catch (error) {
    console.error('CRM admins PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update admin' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'admins:delete',
      level: 'sensitive',
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id') || ''
    if (!id || id.length > 128) {
      return NextResponse.json({ error: 'Admin ID required' }, { status: 400 })
    }
    if (id === security.adminId) {
      return NextResponse.json({ error: 'You cannot delete your own active staff account' }, { status: 409 })
    }

    const current = await prisma.adminUser.findUnique({
      where: { id },
      select: safeAdminSelect(),
    })
    if (!current || current.deletedAt) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    if (
      current.role === 'SUPER_ADMIN' &&
      current.isActive &&
      (await activeSuperAdminCount()) <= 1
    ) {
      return NextResponse.json({ error: 'Cannot delete the last active SUPER_ADMIN' }, { status: 409 })
    }

    await prisma.$transaction([
      prisma.adminUser.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      }),
      prisma.adminSession.updateMany({
        where: { adminUserId: id, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      }),
    ])

    await createAuditLog({
      action: 'DELETE',
      category: 'ADMIN',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'AdminUser',
      entityId: current.id,
      entityName: `${current.firstName} ${current.lastName}`,
      description: 'CRM staff account soft-deleted and sessions revoked',
      oldValue: {
        email: current.email,
        role: current.role,
        assignedCountries: normalizeCountries(current.assignedCountries),
        isActive: current.isActive,
      },
      newValue: { deleted: true, isActive: false },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'HIGH',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('CRM admins DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete admin' }, { status: 500 })
  }
}
