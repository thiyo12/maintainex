import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'
import { evaluateEffectivePermission, getPermissionCatalog } from '@/lib/crm/governance'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, { level: 'read' })
    if (!guard.ok) return guard.response

    const [adminUser, liveSession] = await Promise.all([
      prisma.adminUser.findUnique({
        where: { id: guard.context.adminId },
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
          totpEnabled: true,
        },
      }),
      prisma.adminSession.findUnique({
        where: { id: guard.context.sessionId },
        select: {
          id: true,
          expiresAt: true,
          isRevoked: true,
        },
      }),
    ])
    if (!adminUser || !liveSession || liveSession.isRevoked) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const assignedCountries = guard.context.assignedCountries
    const name = [adminUser.firstName, adminUser.lastName].filter(Boolean).join(' ') || null
    const marketWhere = guard.context.isSuperAdmin
      ? {}
      : { code: { in: assignedCountries } }
    const markets = await prisma.country.findMany({
      where: marketWhere,
      select: { code: true, name: true },
      orderBy: { name: 'asc' },
    })

    const effectivePermissions = getPermissionCatalog()
      .filter(entry => evaluateEffectivePermission({
        role: guard.context.role,
        permission: entry.id,
        permissionClass: entry.class,
        overrides: guard.context.permissionOverrides,
      }).allowed)
      .map(entry => entry.id)

    return NextResponse.json(
      {
        user: {
          id: adminUser.id,
          email: adminUser.email,
          role: guard.context.role,
          firstName: adminUser.firstName || '',
          lastName: adminUser.lastName || '',
          name,
          assignedCountries,
          region: guard.context.isSuperAdmin
            ? 'All markets'
            : assignedCountries.join(', ') || null,
          branchId: null,
          province: null,
          canEditServices: false,
          permissions: effectivePermissions,
          totpEnabled: adminUser.totpEnabled,
          sessionExpiresAt: liveSession.expiresAt.toISOString(),
          markets,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
}
