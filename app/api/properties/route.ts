import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import {
  PUBLIC_REAL_ESTATE_STATUSES,
  isSafePropertyMediaRef,
  readPropertyMediaRefs,
  sanitizePropertyMediaRefs,
  toPublicListingDto,
} from '@/lib/real-estate/visibility'

const PROPERTY_TYPES = new Set(['house', 'apartment', 'commercial', 'land', 'rental'])
const PURPOSES = new Set(['sale', 'rent', 'commercial', 'land'])
const SORTS = new Set(['newest', 'price_asc', 'price_desc', 'most_viewed'])

function finiteNumber(value: string | null): number | null {
  if (value === null || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country') || searchParams.get('countryCode')
    const district = searchParams.get('district')?.trim().slice(0, 120)
    const city = searchParams.get('city')?.trim().slice(0, 120)
    const propertyType = searchParams.get('propertyType')
    const purpose = searchParams.get('purpose')
    const minPrice = finiteNumber(searchParams.get('minPrice'))
    const maxPrice = finiteNumber(searchParams.get('maxPrice'))
    const bedrooms = finiteNumber(searchParams.get('bedrooms'))
    const isFurnished = searchParams.get('isFurnished')
    const requestedSort = searchParams.get('sortBy') || 'newest'
    const sortBy = SORTS.has(requestedSort) ? requestedSort : 'newest'
    const requestedPage = Number.parseInt(searchParams.get('page') || '1', 10)
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '20', 10)
    const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1
    const limit = Number.isFinite(requestedLimit) ? Math.min(50, Math.max(1, requestedLimit)) : 20
    const myOnly = searchParams.get('myOnly') === 'true'
    const requestedStatus = searchParams.get('status')
    const search = searchParams.get('q')?.trim().slice(0, 120)

    const where: any = {}
    let includePrivateFields = false

    if (myOnly) {
      const session = await authenticateMarketplaceUser(request)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      where.postedBy = session.id
      includePrivateFields = true
      if (requestedStatus && ['draft', 'pending', 'approved', 'rejected', 'published'].includes(requestedStatus)) {
        where.status = requestedStatus
      }
    } else {
      // Public discovery never accepts a caller-selected moderation state.
      where.status = { in: [...PUBLIC_REAL_ESTATE_STATUSES] }
    }

    if (country && /^[A-Za-z]{2}$/.test(country)) where.countryCode = country.toUpperCase()
    if (district) where.district = { contains: district }
    if (city) where.city = { contains: city }
    if (propertyType && PROPERTY_TYPES.has(propertyType)) where.propertyType = propertyType
    if (purpose && PURPOSES.has(purpose)) where.purpose = purpose

    if (minPrice !== null || maxPrice !== null) {
      where.priceLkr = {}
      if (minPrice !== null && minPrice >= 0) where.priceLkr.gte = minPrice
      if (maxPrice !== null && maxPrice >= 0) where.priceLkr.lte = maxPrice
    }

    if (bedrooms !== null && bedrooms >= 0) where.bedrooms = { gte: Math.floor(bedrooms) }
    if (isFurnished === 'true') where.isFurnished = true

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { address: { contains: search } },
        { district: { contains: search } },
        { city: { contains: search } },
      ]
    }

    let orderBy: any = { createdAt: 'desc' }
    if (sortBy === 'price_asc') orderBy = { priceLkr: 'asc' }
    else if (sortBy === 'price_desc') orderBy = { priceLkr: 'desc' }
    else if (sortBy === 'most_viewed') orderBy = { views: 'desc' }

    const skip = (page - 1) * limit

    const [listings, total] = await Promise.all([
      prisma.realEstateListing.findMany({
        where,
        orderBy: [
          { isFeatured: 'desc' },
          { boostTier: 'desc' },
          orderBy,
        ],
        skip,
        take: limit,
      }),
      prisma.realEstateListing.count({ where }),
    ])

    const data = includePrivateFields
      ? listings.map(listing => ({
          ...listing,
          photos: readPropertyMediaRefs(listing.photos),
          amenities: listing.amenities ? JSON.parse(listing.amenities) : [],
        }))
      : listings.map(listing => toPublicListingDto(listing))

    return NextResponse.json(
      {
        success: true,
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error: any) {
    console.error('Error fetching properties:', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch properties' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authenticateMarketplaceUser(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(session)
    if (blocked) return blocked

    const body = await request.json().catch(() => ({}))
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 180) : ''
    const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 5000) : null
    const propertyType = typeof body?.propertyType === 'string' ? body.propertyType : ''
    const purpose = typeof body?.purpose === 'string' ? body.purpose : ''
    const priceLkr = Number(body?.priceLkr)
    const countryCode = typeof body?.countryCode === 'string' ? body.countryCode.toUpperCase() : 'LK'

    if (
      title.length < 2 ||
      !PROPERTY_TYPES.has(propertyType) ||
      !PURPOSES.has(purpose) ||
      !Number.isFinite(priceLkr) ||
      priceLkr <= 0 ||
      !/^[A-Z]{2}$/.test(countryCode)
    ) {
      return NextResponse.json(
        { error: 'Valid title, price, property type, purpose and country are required' },
        { status: 400 }
      )
    }

    const safeString = (value: unknown, max: number) =>
      typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
    const safeInt = (value: unknown) => {
      if (value === null || value === undefined || value === '') return null
      const parsed = Number(value)
      return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null
    }
    const safeFloat = (value: unknown) => {
      if (value === null || value === undefined || value === '') return null
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }
    const rawPhotos = Array.isArray(body?.photos) ? body.photos : []
    if (rawPhotos.some((item: unknown) => !isSafePropertyMediaRef(item))) {
      return NextResponse.json({ error: 'Invalid property media reference' }, { status: 400 })
    }
    const photos = sanitizePropertyMediaRefs(rawPhotos, 10)
    const rawVideoUrl = typeof body?.videoUrl === 'string' ? body.videoUrl.trim() : ''
    if (rawVideoUrl && !isSafePropertyMediaRef(rawVideoUrl)) {
      return NextResponse.json({ error: 'Invalid property video reference' }, { status: 400 })
    }
    const videoUrl = rawVideoUrl || null
    const amenities = Array.isArray(body?.amenities)
      ? body.amenities.filter((item: unknown): item is string => typeof item === 'string').map((item: string) => item.slice(0, 120)).slice(0, 50)
      : []

    const listing = await prisma.realEstateListing.create({
      data: {
        postedBy: session.id,
        title,
        description,
        type: purpose,
        propertyType,
        purpose,
        priceLkr,
        pricePer: safeString(body?.pricePer, 40),
        countryCode,
        district: safeString(body?.district, 120),
        city: safeString(body?.city, 120),
        area: safeString(body?.area, 120),
        address: safeString(body?.address, 300),
        latitude: safeFloat(body?.latitude),
        longitude: safeFloat(body?.longitude),
        bedrooms: safeInt(body?.bedrooms),
        bathrooms: safeInt(body?.bathrooms),
        parking: safeInt(body?.parking),
        areaSqft: safeInt(body?.areaSqft),
        propertySize: safeInt(body?.propertySize),
        landSize: safeInt(body?.landSize),
        yearBuilt: safeInt(body?.yearBuilt),
        isFurnished: body?.isFurnished === true,
        isNewProperty: body?.isNewProperty !== false,
        photos: photos.length ? JSON.stringify(photos) : null,
        amenities: amenities.length ? JSON.stringify(amenities) : null,
        videoUrl,
        contactPhone: safeString(body?.contactPhone, 50),
        contactName: safeString(body?.contactName, 120),
        status: 'pending',
      },
    })

    return NextResponse.json({ success: true, data: listing }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating property:', error)
    return NextResponse.json({ error: error?.message || 'Failed to create property' }, { status: 500 })
  }
}
