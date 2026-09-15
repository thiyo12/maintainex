import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/mobile-auth'
import { revokeJobPin } from '@/lib/domain/job-pin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: jobId } = await params

  try {
    const result = await revokeJobPin(jobId, auth.id)
    return NextResponse.json({ success: result.success })
  } catch (error: any) {
    if (error.message === 'Job not found') return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (error.message.includes('Only the job owner')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
