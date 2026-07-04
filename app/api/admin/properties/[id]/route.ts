import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const listing = await prisma.realEstateListing.findUnique({
      where: { id: params.id },
    })

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    const parsed = {
      ...listing,
      photos: listing.photos ? JSON.parse(listing.photos) : [],
      amenities: listing.amenities ? JSON.parse(listing.amenities) : [],
    }

    return NextResponse.json({ success: true, data: parsed })
  } catch (error: any) {
    console.error('Error fetching property:', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch property' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const listing = await prisma.realEstateListing.findUnique({ where: { id: params.id } })
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    await prisma.realEstateListing.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting property:', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete property' }, { status: 500 })
  }
}
