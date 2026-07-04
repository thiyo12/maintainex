import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const favorites = await prisma.propertyFavorite.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch the actual listings
    const listingIds = favorites.map(f => f.listingId)
    const listings = await prisma.realEstateListing.findMany({
      where: { id: { in: listingIds } },
    })

    const listingMap = new Map(listings.map(l => [l.id, l]))

    const data = favorites.map(f => {
      const listing = listingMap.get(f.listingId)
      return {
        ...f,
        listing: listing ? {
          ...listing,
          photos: listing.photos ? JSON.parse(listing.photos) : [],
          amenities: listing.amenities ? JSON.parse(listing.amenities) : [],
        } : null,
      }
    }).filter(f => f.listing)

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching favorites:', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch favorites' }, { status: 500 })
  }
}
