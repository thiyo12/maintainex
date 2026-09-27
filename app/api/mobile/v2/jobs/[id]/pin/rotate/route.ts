import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/mobile-auth'
import { rotateJobPin } from '@/lib/domain/job-pin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: jobId } = await params

  try {
    const result = await rotateJobPin(jobId, auth.id)
    return NextResponse.json({
      success: true,
      pin: result.pin,
      version: result.version,
    })
  } catch (error: any) {
    if (error.message === 'Job not found') return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (error.message.includes('Only the job owner')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (
      error.message.includes('Payment must be protected') ||
      error.message.includes('PIN is only available') ||
      error.message.includes('No active PIN found') ||
      error.message.includes('Cannot rotate')
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
