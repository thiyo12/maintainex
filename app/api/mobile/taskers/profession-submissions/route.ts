import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { createProfessionSubmission } from '@/lib/profession'

// POST: Submit a new profession request
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || (user.role !== 'TASKER' && user.role !== 'COMPANY')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { requestedName, description, suggestedServices } = body
    if (!requestedName || typeof requestedName !== 'string' || requestedName.trim().length === 0) {
      return NextResponse.json({ error: 'requestedName required' }, { status: 400 })
    }

    const submission = await createProfessionSubmission(prisma, {
      submittedById: user.id,
      requestedName: requestedName.trim(),
      description: description?.trim(),
      suggestedServices: Array.isArray(suggestedServices) ? suggestedServices : undefined,
    })

    return NextResponse.json({ submission }, { status: 201 })
  } catch (error) {
    secureConsole.error('Profession submission error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
