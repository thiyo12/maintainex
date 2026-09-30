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
    const { templateJobId, providerId, providerType, date, timeSlot, address, district, notes, latitude, longitude, countryCode } = body

    if (!templateJobId || !providerId || !date || !timeSlot || !address || !district) {
      return NextResponse.json({
        error: 'Missing required fields: templateJobId, providerId, date, timeSlot, address, district',
      }, { status: 400 })
    }

    const scheduledDate = new Date(date)
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: 'Invalid booking date' }, { status: 400 })
    }
    const bookingDay = new Date(scheduledDate)
    bookingDay.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (bookingDay < today) {
      return NextResponse.json({ error: 'Booking date cannot be in the past' }, { status: 400 })
    }

    const normalizedTimeSlot = String(timeSlot).trim().toLowerCase()
    if (!['morning', 'afternoon', 'evening', 'anytime'].includes(normalizedTimeSlot)) {
      return NextResponse.json({ error: 'Invalid timeSlot' }, { status: 400 })
    }

    const normalizedProviderType =
      providerType == null || providerType === ''
        ? 'INDIVIDUAL'
        : String(providerType).trim().toUpperCase()
    if (!['INDIVIDUAL', 'COMPANY'].includes(normalizedProviderType)) {
      return NextResponse.json({ error: 'providerType must be INDIVIDUAL or COMPANY' }, { status: 400 })
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
      providerType: normalizedProviderType as 'INDIVIDUAL' | 'COMPANY',
      scheduledDate,
      timeSlot: normalizedTimeSlot,
      address: String(address).trim(),
      district: String(district).trim(),
      notes: typeof notes === 'string' ? notes.slice(0, 5000) : undefined,
      latitude: typeof latitude === 'number' ? latitude : undefined,
      longitude: typeof longitude === 'number' ? longitude : undefined,
      countryCode: requestedCountryCode,
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
      message.includes('Cannot book your own company') ||
      message.includes('Invalid template/category') ||
      message.includes('does not match booking country') ||
      message.includes('does not serve the requested district')
    ) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    if (
      message.includes('overlapping active booking') ||
      message.includes('no longer available for direct booking') ||
      message.includes('currently unavailable') ||
      message.includes('unavailable on the requested') ||
      message.includes('outside provider working hours')
    ) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    if (
      message.includes('Booking country is required') ||
      message.includes('availability configuration is invalid')
    ) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
