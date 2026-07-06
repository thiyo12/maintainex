import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize } from '@/lib/admin-rbac'

export async function GET(request: NextRequest) {
  try {
    const rawSession = getSessionFromCookie(request)
    const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN'])(rawSession)
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const country = searchParams.get('country')
    const propertyType = searchParams.get('propertyType')
    const search = searchParams.get('q')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {}

    if (status && status !== 'all') where.status = status
    if (country) where.countryCode = country
    if (propertyType) where.propertyType = propertyType

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { address: { contains: search } },
        { contactName: { contains: search } },
      ]
    }

    const skip = (page - 1) * limit

    const [listings, total] = await Promise.all([
      prisma.realEstateListing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.realEstateListing.count({ where }),
    ])

    const parsed = listings.map(l => ({
      ...l,
      photos: l.photos ? JSON.parse(l.photos) : [],
      amenities: l.amenities ? JSON.parse(l.amenities) : [],
    }))

    return NextResponse.json({
      success: true,
      data: parsed,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (error: any) {
    console.error('Error fetching admin properties:', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch properties' }, { status: 500 })
  }
}
