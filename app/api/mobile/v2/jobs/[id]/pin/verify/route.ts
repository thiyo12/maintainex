import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/mobile-auth'
import { verifyJobPin } from '@/lib/domain/job-pin'
import { prisma } from '@/lib/prisma'
import { notifyJobStarted } from '@/lib/notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: jobId } = await params

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { pin, purpose } = body
  if (!pin || typeof pin !== 'string') {
    return NextResponse.json({ error: 'PIN is required' }, { status: 400 })
  }
  if (!purpose || !['ARRIVAL', 'WORK_START', 'COMPLETION'].includes(purpose)) {
    return NextResponse.json({ error: 'Invalid purpose. Must be ARRIVAL, WORK_START, or COMPLETION' }, { status: 400 })
  }

  const result = await verifyJobPin(jobId, auth.id, pin, purpose)

  if (!result.valid) {
    const error = result.error || 'PIN verification failed'
    const status = result.locked
      ? 423
      : error.includes('Not authorized')
        ? 403
        : error.includes('No active PIN') ||
            error.includes('Cannot verify PIN') ||
            error.includes('already verified')
          ? 409
          : 401
    return NextResponse.json({ error, locked: result.locked }, { status })
  }

  if (purpose === 'WORK_START') {
    const job = await prisma.marketplaceJob.findUnique({
      where: { id: jobId },
      select: { customerId: true, title: true },
    })
    if (job) {
      await notifyJobStarted(jobId, job.customerId, job.title)
    }
  }

  return NextResponse.json({ success: true, purpose })
}
