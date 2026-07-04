import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const listing = await prisma.realEstateListing.findUnique({
      where: { id },
    })

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    const parsed = {
      ...listing,
      location: listing.address || '',
      photos: listing.photos ? JSON.parse(listing.photos) : [],
      amenities: listing.amenities ? JSON.parse(listing.amenities) : [],
    }

    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error('Error fetching listing:', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch listing' }, { status: 500 })
  }
}
