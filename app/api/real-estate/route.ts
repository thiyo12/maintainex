import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status') || 'active'
    const search = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = { status }

    if (type && type !== 'all') {
      where.type = type
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { address: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const listings = await prisma.realEstateListing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    const parsed = listings.map((l) => ({
      ...l,
      location: l.address || '',
      photos: l.photos ? JSON.parse(l.photos) : [],
      amenities: l.amenities ? JSON.parse(l.amenities) : [],
    }))

    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error('Error fetching listings:', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch listings' }, { status: 500 })
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
      title, description, type, priceLkr, pricePer,
      bedrooms, bathrooms, areaSqft, address,
      latitude, longitude, photos, amenities, isFurnished,
    } = body

    if (!title || !priceLkr || !type) {
      return NextResponse.json({ error: 'Title, price, and type are required' }, { status: 400 })
    }

    const listing = await prisma.realEstateListing.create({
      data: {
        postedBy: session.id,
        title,
        description: description || null,
        type,
        priceLkr: parseFloat(priceLkr),
        pricePer: pricePer || null,
        bedrooms: bedrooms ? parseInt(bedrooms) : null,
        bathrooms: bathrooms ? parseInt(bathrooms) : null,
        areaSqft: areaSqft ? parseInt(areaSqft) : null,
        address: address || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        photos: photos ? JSON.stringify(photos) : null,
        amenities: amenities ? JSON.stringify(amenities) : null,
        isFurnished: isFurnished || false,
        status: 'active',
      },
    })

    return NextResponse.json(listing, { status: 201 })
  } catch (error: any) {
    console.error('Error creating listing:', error)
    return NextResponse.json({ error: error?.message || 'Failed to create listing' }, { status: 500 })
  }
}
