import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlatformRuntimeConfig } from '@/lib/runtime/platform-runtime'
import { isSeasonalOfferJobAvailableInMarket } from '@/lib/domain/seasonal-offer-market'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const country = (searchParams.get('country') || 'LK').trim().toUpperCase()
    if (country !== 'LK' && country !== 'CA') {
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
    }
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
              select: { id: true, name: true, description: true, priceMin: true, priceMax: true, currency: true, countries: true, isActive: true, category: { select: { countries: true, isActive: true } } },
            },
          },
          orderBy: { templateJob: { name: 'asc' } },
        },
      },
      orderBy: { displayOrder: 'asc' },
    })

    offers = offers
      .map(offer => ({
        ...offer,
        jobs: offer.jobs.filter(job => isSeasonalOfferJobAvailableInMarket(job, country)),
      }))
      .filter(offer => offer.jobs.length > 0)

    if (offers.length === 0 && season !== 'general') {
      offers = await prisma.seasonalOffer.findMany({
        where: { isActive: true, country, season: 'general' },
        include: { jobs: { include: { templateJob: { select: { id: true, name: true, description: true, priceMin: true, priceMax: true, currency: true, countries: true, isActive: true, category: { select: { countries: true, isActive: true } } } } }, orderBy: { templateJob: { name: 'asc' } } } },
        orderBy: { displayOrder: 'asc' },
      })
    }

    // General offers are subject to the same market and activation rules.
    offers = offers
      .map(offer => ({
        ...offer,
        jobs: offer.jobs.filter(job => isSeasonalOfferJobAvailableInMarket(job, country)),
      }))
      .filter(offer => offer.jobs.length > 0)

    return NextResponse.json(offers, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (error) {
    secureConsole.error('Error fetching mobile seasonal offers:', error)
    return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 })
  }
}
