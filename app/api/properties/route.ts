import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/authentication/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country') || searchParams.get('countryCode')
    const district = searchParams.get('district')
    const city = searchParams.get('city')
    const propertyType = searchParams.get('propertyType')
    const purpose = searchParams.get('purpose')
    const status = searchParams.get('status') || 'approved'
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const bedrooms = searchParams.get('bedrooms')
    const isFurnished = searchParams.get('isFurnished')
    const sortBy = searchParams.get('sortBy') || 'newest'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const myOnly = searchParams.get('myOnly') === 'true'
    const search = searchParams.get('q')

    const where: any = {}

    // If myOnly, require auth
    if (myOnly) {
      const session = await getSession(request)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      where.postedBy = session.id
      // Show all statuses for my listings
    } else {
      where.status = status
    }

    if (country) where.countryCode = country
    if (district) where.district = { contains: district }
    if (city) where.city = { contains: city }
    if (propertyType) where.propertyType = propertyType
    if (purpose) where.purpose = purpose

    if (minPrice || maxPrice) {
      where.priceLkr = {}
      if (minPrice) where.priceLkr.gte = parseFloat(minPrice)
      if (maxPrice) where.priceLkr.lte = parseFloat(maxPrice)
    }

    if (bedrooms) where.bedrooms = { gte: parseInt(bedrooms) }
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

    // Sort
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

    const parsed = listings.map(l => ({
      ...l,
      photos: l.photos ? JSON.parse(l.photos) : [],
      amenities: l.amenities ? JSON.parse(l.amenities) : [],
      contactPhone: myOnly ? l.contactPhone : undefined,
      contactName: myOnly ? l.contactName : undefined,
    }))

    return NextResponse.json({
      success: true,
      data: parsed,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (error: any) {
    console.error('Error fetching properties:', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch properties' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title, description, propertyType, purpose, priceLkr, pricePer,
      countryCode, district, city, area, address, latitude, longitude,
      bedrooms, bathrooms, parking, areaSqft, propertySize, landSize,
      yearBuilt, isFurnished, isNewProperty, photos, amenities, videoUrl,
      contactPhone, contactName,
    } = body

    if (!title || !priceLkr || !propertyType || !purpose) {
      return NextResponse.json({ error: 'Title, price, property type, and purpose are required' }, { status: 400 })
    }

    const listing = await prisma.realEstateListing.create({
      data: {
        postedBy: session.id,
        title,
        description: description || null,
        type: purpose, // legacy field
        propertyType,
        purpose,
        priceLkr: parseFloat(priceLkr),
        pricePer: pricePer || null,
        countryCode: countryCode || 'LK',
        district: district || null,
        city: city || null,
        area: area || null,
        address: address || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        bedrooms: bedrooms ? parseInt(bedrooms) : null,
        bathrooms: bathrooms ? parseInt(bathrooms) : null,
        parking: parking ? parseInt(parking) : null,
        areaSqft: areaSqft ? parseInt(areaSqft) : null,
        propertySize: propertySize ? parseInt(propertySize) : null,
        landSize: landSize ? parseInt(landSize) : null,
        yearBuilt: yearBuilt ? parseInt(yearBuilt) : null,
        isFurnished: isFurnished || false,
        isNewProperty: isNewProperty !== false,
        photos: photos ? JSON.stringify(photos) : null,
        amenities: amenities ? JSON.stringify(amenities) : null,
        videoUrl: videoUrl || null,
        contactPhone: contactPhone || null,
        contactName: contactName || null,
        status: 'pending', // Requires admin review
      },
    })

    return NextResponse.json({ success: true, data: listing }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating property:', error)
    return NextResponse.json({ error: error?.message || 'Failed to create property' }, { status: 500 })
  }
}
