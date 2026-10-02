import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/authentication/auth-utils'
import {
  PUBLIC_REAL_ESTATE_STATUSES,
  toPublicListingDto,
} from '@/lib/real-estate/visibility'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const favorites = await prisma.propertyFavorite.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const listingIds = favorites.map(favorite => favorite.listingId)
    const listings = await prisma.realEstateListing.findMany({
      where: {
        id: { in: listingIds },
        status: { in: [...PUBLIC_REAL_ESTATE_STATUSES] },
      },
    })

    const listingMap = new Map(listings.map(listing => [listing.id, listing]))
    const data = favorites
      .map(favorite => {
        const listing = listingMap.get(favorite.listingId)
        return listing
          ? {
              ...favorite,
              listing: toPublicListingDto(listing),
            }
          : null
      })
      .filter(Boolean)

    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error: any) {
    console.error('Error fetching favorites:', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch favorites' }, { status: 500 })
  }
}
