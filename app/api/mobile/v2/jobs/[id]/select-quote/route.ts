import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { acceptJobQuote } from '@/lib/domain/job-lifecycle'
import { notifyQuoteAccepted } from '@/lib/notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const quoteId = typeof body.quoteId === 'string' ? body.quoteId.trim() : ''
    if (!quoteId) return NextResponse.json({ error: 'quoteId required' }, { status: 400 })

    const result = await acceptJobQuote(
      { jobId: params.id, actorId: user.id, actorType: 'CUSTOMER' },
      quoteId
    )

    notifyQuoteAccepted(result.job.id, result.quote.providerId, result.job.title)

    return NextResponse.json({
      success: true,
      quote: {
        ...result.quote,
        price: result.quote.price.toString(),
      },
    })
  } catch (error: any) {
    console.error('Select quote error:', error)
    const message = error?.message || 'Server error'
    if (message.includes('Only the customer')) return NextResponse.json({ error: message }, { status: 403 })
    if (message.includes('not found')) return NextResponse.json({ error: message }, { status: 404 })
    if (
      message.includes('not open') ||
      message.includes('not in PENDING') ||
      message.includes('already') ||
      message.includes('no longer available')
    ) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
