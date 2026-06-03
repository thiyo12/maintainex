import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/mobile-auth'
import { matchProvidersForJob } from '@/lib/matching-engine'

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const user = await authenticateRequest(_request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const providers = await matchProvidersForJob(params.jobId)

    return NextResponse.json({ providers })
  } catch (error) {
    console.error('Match error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
