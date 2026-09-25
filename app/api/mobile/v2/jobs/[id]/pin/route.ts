import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/mobile-auth'
import { getPinState, generateJobPin } from '@/lib/domain/job-pin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: jobId } = await params

  try {
    const state = await getPinState(jobId, auth.id)
    return NextResponse.json({ pinState: state })
  } catch (error: any) {
    if (error.message === 'Job not found') return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (error.message === 'Only the job owner can view PIN state') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: jobId } = await params

  try {
    const result = await generateJobPin(jobId, auth.id)
    return NextResponse.json({
      success: true,
      pin: result.pin,
      version: result.version,
    }, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Job not found') return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (error.message.includes('Only the job owner')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (
      error.message.includes('active PIN already exists') ||
      error.message.includes('Payment must be protected') ||
      error.message.includes('PIN is only available')
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
