import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  console.log('=== Session API called ===')
  console.log('Headers:', Object.fromEntries(request.headers.entries()))
  
  const session = await getSession(request)
  console.log('Session result:', session)
  
  if (!session) {
    return NextResponse.json({ 
      error: 'Not authenticated',
      user: null 
    }, { status: 401 })
  }
  
  return NextResponse.json({
    user: {
      id: session.id,
      email: session.email,
      role: session.role,
      branchId: session.branchId,
      canEditServices: session.canEditServices
    }
  })
}
