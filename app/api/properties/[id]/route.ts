import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/authentication/auth-utils'
import {
  isPublicRealEstateStatus,
  isSafePropertyMediaRef,
  readPropertyMediaRefs,
  sanitizePropertyMediaRefs,
  toPublicListingDto,
} from '@/lib/real-estate/visibility'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession(request)

    const listing = await prisma.realEstateListing.findUnique({
      where: { id },
    })

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    const isOwner = Boolean(session?.id && listing.postedBy === session.id)
    const isPublic = isPublicRealEstateStatus(listing.status)

    if (!isPublic && !isOwner) {
      // Do not leak whether a draft/rejected/pending listing exists.
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    let views = listing.views
    if (isPublic && !isOwner) {
      const updated = await prisma.realEstateListing.update({
        where: { id },
        data: { views: { increment: 1 } },
        select: { views: true },
      })
      views = updated.views
    }

    const data = isOwner
      ? {
          ...listing,
          views,
          photos: readPropertyMediaRefs(listing.photos),
          amenities: listing.amenities ? JSON.parse(listing.amenities) : [],
        }
      : {
          ...toPublicListingDto(listing, { includeContact: Boolean(session) }),
          views,
        }

    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': 'no-store' } }
    )
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
    const body = await request.json().catch(() => ({}))

    const listing = await prisma.realEstateListing.findUnique({ where: { id } })
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    // CRM moderation is deliberately handled by /api/admin/real-estate.
    if (listing.postedBy !== session.id) {
      return NextResponse.json({ error: 'You can only edit your own listings' }, { status: 403 })
    }

    const data: any = {}
    const stringLimits: Record<string, number> = {
      title: 180,
      description: 5000,
      propertyType: 40,
      purpose: 40,
      pricePer: 40,
      countryCode: 2,
      district: 120,
      city: 120,
      area: 120,
      address: 300,
      contactPhone: 50,
      contactName: 120,
    }
    const numericFields = new Set([
      'latitude', 'longitude', 'bedrooms', 'bathrooms', 'parking',
      'areaSqft', 'propertySize', 'landSize', 'yearBuilt',
    ])

    for (const [field, max] of Object.entries(stringLimits)) {
      if (body[field] !== undefined) {
        data[field] = typeof body[field] === 'string'
          ? body[field].trim().slice(0, max)
          : null
      }
    }

    for (const field of numericFields) {
      if (body[field] !== undefined) {
        const parsed = Number(body[field])
        if (!Number.isFinite(parsed)) {
          return NextResponse.json({ error: `Invalid numeric field: ${field}` }, { status: 400 })
        }
        data[field] = ['bedrooms', 'bathrooms', 'parking', 'areaSqft', 'propertySize', 'landSize', 'yearBuilt'].includes(field)
          ? Math.max(0, Math.floor(parsed))
          : parsed
      }
    }

    if (body.priceLkr !== undefined) {
      const price = Number(body.priceLkr)
      if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
      }
      data.priceLkr = price
    }
    if (body.photos !== undefined) {
      if (!Array.isArray(body.photos)) return NextResponse.json({ error: 'Invalid photos' }, { status: 400 })
      if (body.photos.some((item: unknown) => !isSafePropertyMediaRef(item))) {
        return NextResponse.json({ error: 'Invalid property media reference' }, { status: 400 })
      }
      data.photos = JSON.stringify(sanitizePropertyMediaRefs(body.photos, 10))
    }
    if (body.videoUrl !== undefined) {
      const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : ''
      if (videoUrl && !isSafePropertyMediaRef(videoUrl)) {
        return NextResponse.json({ error: 'Invalid property video reference' }, { status: 400 })
      }
      data.videoUrl = videoUrl || null
    }
    if (body.amenities !== undefined) {
      if (!Array.isArray(body.amenities)) return NextResponse.json({ error: 'Invalid amenities' }, { status: 400 })
      data.amenities = JSON.stringify(
        body.amenities.filter((item: unknown): item is string => typeof item === 'string').map((item: string) => item.slice(0, 120)).slice(0, 50)
      )
    }
    if (body.isFurnished !== undefined) data.isFurnished = body.isFurnished === true
    if (body.isNewProperty !== undefined) data.isNewProperty = body.isNewProperty === true

    if (body.title !== undefined || body.priceLkr !== undefined || body.propertyType !== undefined || body.purpose !== undefined) {
      data.status = 'pending'
      data.rejectionReason = null
      data.reviewedBy = null
      data.reviewedAt = null
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

    if (listing.postedBy !== session.id) {
      return NextResponse.json({ error: 'You can only delete your own listings' }, { status: 403 })
    }

    await prisma.realEstateListing.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting property:', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete property' }, { status: 500 })
  }
}
