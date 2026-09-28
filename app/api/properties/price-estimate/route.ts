import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/authentication/auth-utils'
import { getAIPropertyPriceEstimate } from '@/lib/property-pricing'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      countryCode, district, city, propertyType, purpose,
      bedrooms, bathrooms, areaSqft, landSize,
      isFurnished, isNewProperty,
    } = body

    if (!propertyType || !purpose) {
      return NextResponse.json({ error: 'Property type and purpose are required' }, { status: 400 })
    }

    const estimate = await getAIPropertyPriceEstimate({
      countryCode: countryCode || 'LK',
      district,
      city,
      propertyType,
      purpose,
      bedrooms,
      bathrooms,
      areaSqft,
      landSize,
      isFurnished,
      isNewProperty,
    })

    return NextResponse.json({ success: true, data: estimate })
  } catch (error: any) {
    console.error('Error estimating price:', error)
    return NextResponse.json({ error: error?.message || 'Failed to estimate price' }, { status: 500 })
  }
}
