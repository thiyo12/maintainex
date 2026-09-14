import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/mobile-auth'
import { verifyJobPin } from '@/lib/domain/job-pin'

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
    const status = result.locked ? 423 : 401
    return NextResponse.json({ error: result.error, locked: result.locked }, { status })
  }

  return NextResponse.json({ success: true, purpose })
}
