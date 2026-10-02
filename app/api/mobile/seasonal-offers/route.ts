import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlatformRuntimeConfig } from '@/lib/runtime/platform-runtime'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country') || 'LK'
    const season = searchParams.get('season') || 'general'
    const runtime = await getPlatformRuntimeConfig(country)
    if (
      runtime.maintenance.enabled ||
      !runtime.channels.mobile ||
      !runtime.offers.visible ||
      !runtime.market.available
    ) {
      return NextResponse.json([], {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      })
    }

    let offers = await prisma.seasonalOffer.findMany({
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

    if (offers.length === 0) {
      offers = await prisma.seasonalOffer.findMany({
        where: { isActive: true, country, season: 'general' },
        include: { jobs: { include: { templateJob: { select: { id: true, name: true, description: true, priceMin: true, priceMax: true, currency: true } } }, orderBy: { templateJob: { name: 'asc' } } } },
        orderBy: { displayOrder: 'asc' },
      })
    }

    return NextResponse.json(offers, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (error) {
    console.error('Error fetching mobile seasonal offers:', error)
    return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 })
  }
}
