import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country') || 'LK'
    const season = searchParams.get('season') || 'general'

    const offers = await prisma.seasonalOffer.findMany({
      where: { isActive: true, country, season },
      include: {
        jobs: {
          include: {
            templateJob: {
              select: { id: true, name: true, description: true, priceMin: true, priceMax: true, currency: true },
            },
          },
          orderBy: { templateJob: { name: 'asc' } },
        },
      },
      orderBy: { displayOrder: 'asc' },
    })

    return NextResponse.json(offers, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (error) {
    console.error('Error fetching mobile seasonal offers:', error)
    return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 })
  }
}
