import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/authentication/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const season = searchParams.get('season')
    const country = searchParams.get('country')

    const where: any = { isActive: true }
    if (season) where.season = season
    if (country) where.country = country

    const offers = await prisma.seasonalOffer.findMany({
      where,
      include: {
        jobs: {
          include: { templateJob: { include: { category: true } } },
          orderBy: { templateJob: { name: 'asc' } },
        },
      },
      orderBy: { displayOrder: 'asc' },
    })

    return NextResponse.json(offers)
  } catch (error) {
    console.error('Error fetching seasonal offers:', error)
    return NextResponse.json({ error: 'Failed to fetch seasonal offers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, slug, season, country, image, badgeText, bgColor, textColor, displayOrder } = body

    if (!title || !slug || !season || !country) {
      return NextResponse.json({ error: 'Title, slug, season, and country are required' }, { status: 400 })
    }

    if (!['winter', 'spring', 'summer', 'fall', 'general'].includes(season)) {
      return NextResponse.json({ error: 'Invalid season' }, { status: 400 })
    }

    if (!['LK', 'CA'].includes(country)) {
      return NextResponse.json({ error: 'Invalid country' }, { status: 400 })
    }

    let order = displayOrder
    if (order === undefined || order === null) {
      const maxOrder = await prisma.seasonalOffer.aggregate({ _max: { displayOrder: true } })
      order = (maxOrder._max.displayOrder || 0) + 1
    }

    const offer = await prisma.seasonalOffer.create({
      data: { title, description: description || null, slug, season, country, image: image || null, badgeText: badgeText || null, bgColor: bgColor || null, textColor: textColor || null, displayOrder: order, isActive: true },
    })

    return NextResponse.json(offer, { status: 201 })
  } catch (error) {
    console.error('Error creating seasonal offer:', error)
    return NextResponse.json({ error: 'Failed to create seasonal offer' }, { status: 500 })
  }
}
