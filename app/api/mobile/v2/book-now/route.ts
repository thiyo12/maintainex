import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { createBookNowJob } from '@/lib/domain/book-now'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { templateJobId, providerId, date, timeSlot, address, district, notes, latitude, longitude, countryCode } = body

    if (!templateJobId || !providerId || !date || !timeSlot || !address || !district) {
      return NextResponse.json({
        error: 'Missing required fields: templateJobId, providerId, date, timeSlot, address, district',
      }, { status: 400 })
    }

    const scheduledDate = new Date(date)
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: 'Invalid booking date' }, { status: 400 })
    }

    const requestedCountryCode = typeof countryCode === 'string' && countryCode.trim()
      ? countryCode.trim().toUpperCase()
      : user.countryCode

    if (requestedCountryCode !== user.countryCode) {
      return NextResponse.json({
        error: 'Country mismatch: you cannot create jobs in a different country',
        code: 'COUNTRY_MISMATCH',
      }, { status: 403 })
    }

    const result = await createBookNowJob({
      customerId: user.id,
      templateJobId: String(templateJobId).trim(),
      providerId: String(providerId).trim(),
      scheduledDate,
      timeSlot: String(timeSlot).trim(),
      address: String(address).trim(),
      district: String(district).trim(),
      notes: typeof notes === 'string' ? notes.slice(0, 5000) : undefined,
      latitude: typeof latitude === 'number' ? latitude : undefined,
      longitude: typeof longitude === 'number' ? longitude : undefined,
      countryCode: typeof countryCode === 'string' ? countryCode : undefined,
    })

    return NextResponse.json({
      job: result.job,
      quote: result.quote,
      notifiedCount: result.notifiedCount,
      message: 'BOOK_NOW job created. Accept the quote to proceed.',
    }, { status: 201 })
  } catch (error: any) {
    console.error('BOOK_NOW error:', error)
    const message = error?.message || 'Server error'
    if (message.includes('not found')) return NextResponse.json({ error: message }, { status: 404 })
    if (
      message.includes('not eligible') ||
      message.includes('lacks required capability') ||
      message.includes('Cannot book yourself') ||
      message.includes('Invalid template/category')
    ) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
