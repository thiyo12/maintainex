import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/authentication/auth-utils'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const listing = await prisma.realEstateListing.findUnique({
      where: { id },
    })

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    // Increment view count
    await prisma.realEstateListing.update({
      where: { id },
      data: { views: { increment: 1 } },
    })

    const parsed = {
      ...listing,
      views: listing.views + 1,
      photos: listing.photos ? JSON.parse(listing.photos) : [],
      amenities: listing.amenities ? JSON.parse(listing.amenities) : [],
    }

    return NextResponse.json({ success: true, data: parsed })
  } catch (error: any) {
    console.error('Error fetching property:', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch property' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const listing = await prisma.realEstateListing.findUnique({ where: { id } })
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.postedBy !== session.id && session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized - You can only edit your own listings' }, { status: 403 })
    }

    const data: any = {}
    const fields = [
      'title', 'description', 'propertyType', 'purpose', 'pricePer',
      'countryCode', 'district', 'city', 'area', 'address',
      'latitude', 'longitude', 'bedrooms', 'bathrooms', 'parking',
      'areaSqft', 'propertySize', 'landSize', 'yearBuilt',
      'isFurnished', 'isNewProperty', 'videoUrl', 'contactPhone', 'contactName',
    ]

    for (const field of fields) {
      if (body[field] !== undefined) data[field] = body[field]
    }

    if (body.priceLkr !== undefined) data.priceLkr = parseFloat(body.priceLkr)
    if (body.photos !== undefined) data.photos = JSON.stringify(body.photos)
    if (body.amenities !== undefined) data.amenities = JSON.stringify(body.amenities)

    // Reset to pending if significant changes
    if (body.title || body.priceLkr || body.propertyType || body.purpose) {
      data.status = 'pending'
      data.rejectionReason = null
    }

    const updated = await prisma.realEstateListing.update({
      where: { id },
      data,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Error updating property:', error)
    return NextResponse.json({ error: error?.message || 'Failed to update property' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const listing = await prisma.realEstateListing.findUnique({ where: { id } })
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.postedBy !== session.id && session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized - You can only delete your own listings' }, { status: 403 })
    }

    await prisma.realEstateListing.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting property:', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete property' }, { status: 500 })
  }
}
