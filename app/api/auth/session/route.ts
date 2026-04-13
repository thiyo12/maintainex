import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  
  return NextResponse.json({
    user: {
      id: session.id,
      email: session.email,
      role: session.role,
      branchId: session.branchId
    }
  })
}
