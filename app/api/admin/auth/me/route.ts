import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/authentication/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const session: any = await getAdminSession(request)
    const id = session?.adminUserId || session?.id || session?.sub
    if (!session || !id || !session.email || !session.role) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const assignedCountries = Array.isArray(session.assignedCountries)
      ? session.assignedCountries
          .filter((value: unknown): value is string => typeof value === 'string')
          .map((value: string) => value.trim().toUpperCase())
          .filter(Boolean)
      : []

    const firstName = typeof session.firstName === 'string' ? session.firstName : ''
    const lastName = typeof session.lastName === 'string' ? session.lastName : ''

    return NextResponse.json(
      {
        user: {
          id,
          email: session.email,
          role: session.role,
          firstName,
          lastName,
          name: [firstName, lastName].filter(Boolean).join(' ') || session.name || null,
          assignedCountries,
          region: session.role === 'SUPER_ADMIN' ? 'All markets' : assignedCountries.join(', ') || null,
          branchId: session.branchId || null,
          province: session.province || null,
          canEditServices: Boolean(session.canEditServices),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
}
