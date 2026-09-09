import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { createBookNowJob } from '@/lib/domain/book-now'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { templateJobId, providerId, date, timeSlot, address, district, notes, latitude, longitude } = body

    if (!templateJobId || !providerId || !date || !timeSlot || !address || !district) {
      return NextResponse.json({
        error: 'Missing required fields: templateJobId, providerId, date, timeSlot, address, district',
      }, { status: 400 })
    }

    const result = await createBookNowJob({
      customerId: user.id,
      templateJobId,
      providerId,
      scheduledDate: new Date(date),
      timeSlot,
      address,
      district,
      notes,
      latitude: typeof latitude === 'number' ? latitude : undefined,
      longitude: typeof longitude === 'number' ? longitude : undefined,
    })

    return NextResponse.json({
      job: result.job,
      quote: result.quote,
      notifiedCount: result.notifiedCount,
      message: 'BOOK_NOW job created. Accept the quote to proceed.',
    }, { status: 201 })
  } catch (error: any) {
    console.error('BOOK_NOW error:', error)
    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
