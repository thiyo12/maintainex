import { secureConsole } from '@/lib/shared/observability/secure-console'
import { resolveMarketFromServiceAddress } from '@/lib/geography/market-engine'
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

    // Phase 02: the service address decides the market. The client-claimed
    // country is advisory only and can never authorize a booking.
    const market = resolveMarketFromServiceAddress({
      district: String(district).trim(),
      latitude: typeof latitude === 'number' ? latitude : undefined,
      longitude: typeof longitude === 'number' ? longitude : undefined,
      claimedCountryCode: typeof countryCode === 'string' ? countryCode : user.countryCode,
    })

    if (!market.ok) {
      return NextResponse.json({ error: market.error, code: market.code }, { status: 400 })
    }

    const requestedCountryCode = market.countryCode

    // A valid coordinate market must not be combined with an arbitrary district
    // supplied by the client. All 25 named LK districts are supported; CA is
    // the Vancouver municipality only. Persist the canonical district label.
    if (!market.district) {
      return NextResponse.json({
        error: 'District does not match the verified service address market',
        code: 'SERVICE_DISTRICT_MISMATCH',
      }, { status: 400 })
    }

    if (user.countryCode && requestedCountryCode !== user.countryCode.toUpperCase()) {
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
      district: market.district,
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
    secureConsole.error('BOOK_NOW error:', error)
    const message = error?.message || 'Server error'
    if (message.includes('not found')) return NextResponse.json({ error: message }, { status: 404 })
    if (
      message.includes('not eligible') ||
      message.includes('lacks required capability') ||
      message.includes('Cannot book yourself') ||
      message.includes('Cannot book your own company') ||
      message.includes('Invalid template/category') ||
      message.includes('Template job is not available in booking country') ||
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
      message.includes('Unsupported booking country') ||
      message.includes('availability configuration is invalid')
    ) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
