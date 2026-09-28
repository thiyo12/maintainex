import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/authentication/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        id: session.id,
        email: session.email,
        role: session.role,
        name: session.name,
        branchId: session.branchId || null,
        province: session.province || null,
        region: session.region || null,
        canEditServices: session.canEditServices || false,
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
}
