import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { acceptJobQuote } from '@/lib/domain/job-lifecycle'
import { notifyQuoteAccepted } from '@/lib/notifications'
import { getCurrencyForCountry, minorUnitsToMajorUnits } from '@/lib/shared/money/money'

async function resolveNotificationUser(providerId: string, providerType: string): Promise<string> {
  if (providerType === 'COMPANY') {
    const company = await prisma.companyProfile.findUnique({
      where: { id: providerId },
      select: { userId: true },
    })
    if (!company) throw new Error('Company provider not found')
    return company.userId
  }
  return providerId
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const quoteId = typeof body.quoteId === 'string' ? body.quoteId.trim() : ''
    if (!quoteId) return NextResponse.json({ error: 'quoteId required' }, { status: 400 })

    const result = await acceptJobQuote(
      { jobId: id, actorId: user.id, actorType: 'CUSTOMER' },
      quoteId,
    )

    try {
      const notificationUserId = await resolveNotificationUser(
        result.quote.providerId,
        result.quote.providerType,
      )
      await notifyQuoteAccepted(result.job.id, notificationUserId, result.job.title)
    } catch (notificationError) {
      console.error('Quote accepted notification failed after successful acceptance:', notificationError)
    }

    const currency = getCurrencyForCountry(result.job.countryCode)
    return NextResponse.json({
      success: true,
      quote: {
        ...result.quote,
        price: minorUnitsToMajorUnits(result.quote.price, currency),
        subtotalCents: result.quote.subtotalCents?.toString() ?? null,
        taxCents: result.quote.taxCents?.toString() ?? null,
        totalCents: result.quote.totalCents?.toString() ?? null,
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
