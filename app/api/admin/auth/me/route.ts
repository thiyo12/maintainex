import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, { level: 'read' })
    if (!guard.ok) return guard.response

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: guard.context.adminId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
      },
    })
    if (!adminUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const assignedCountries = guard.context.assignedCountries
    const name = [adminUser.firstName, adminUser.lastName].filter(Boolean).join(' ') || null

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
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
}
