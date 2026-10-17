import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { isCatalogAvailableInMarket } from '@/lib/domain/catalog-market-eligibility'
import { isSupportedMarket, getMarketConfig, type CountryCode } from '@/lib/geography/market-engine'
import { requestCountry } from '@/lib/api/request-country'
import { getPlatformRuntimeConfig } from '@/lib/runtime/platform-runtime'

/**
 * Public canonical V2 marketplace catalogue (Phase 01 / Part 4).
 *
 * The public website previously read `/api/categories`, which is the LEGACY V1
 * `Category` -> `Service` catalogue, while the mobile app reads the canonical V2
 * `JobCategory` -> `TemplateJob` models. That divergence meant the website and
 * the app did not present the same marketplace.
 *
 * This endpoint serves the canonical V2 catalogue in the same response shape the
 * website already consumes, so the public surface can share one source of truth
 * with mobile without rewriting the site.
 *
 * The legacy V1 endpoint is intentionally left untouched: historical bookings and
 * legacy admin features still depend on it.
 *
 * Only ACTIVE, PUBLISHED V2 entries are returned, filtered to the requested
 * launch market. A category is omitted entirely when it has no usable job in that
 * market, so listing a market in metadata is never enough to make it look live.
 */
export async function GET(request: NextRequest) {
  try {
    const requested = requestCountry(request)
    const runtime = await getPlatformRuntimeConfig(requested)
    if (!runtime.catalog.visible || !runtime.market.available) {
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
    }

    if (!isSupportedMarket(requested)) {
      return NextResponse.json(
        { error: 'Market not supported', code: 'MARKET_NOT_SUPPORTED', categories: [] },
        { status: 400 },
      )
    }

    const market = requested as CountryCode
    const expectedCurrency = getMarketConfig(market)?.currency

    const categories = await prisma.jobCategory.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        countries: true,
        jobs: {
          where: { isActive: true, currency: expectedCurrency },
          select: {
            id: true,
            name: true,
            description: true,
            whatIsIncluded: true,
            typicalDurationMinutes: true,
            priceMin: true,
            priceMax: true,
            countries: true,
            currency: true,
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    const payload = categories
      .filter(category => isCatalogAvailableInMarket(category.countries, market))
      .map(category => {
        const jobs = category.jobs.filter(job => isCatalogAvailableInMarket(job.countries, market))
        // A category with no usable job in this market is not offered here.
        if (jobs.length === 0) return null

        return {
          id: category.id,
          name: category.name,
          slug: category.slug || '',
          description: null,
          icon: null,
          image: null,
          displayOrder: 0,
          serviceCount: jobs.length,
          services: jobs.map(job => ({
            id: job.id,
            name: job.name,
            title: job.name,
            slug: job.id,
            description: job.description || job.whatIsIncluded || '',
            image: null,
            // Indicative range only. Market-specific booking configuration lives on
            // ServiceTemplate; the public list never invents a Canadian price.
            price: job.priceMin === null ? null : Number(job.priceMin),
            priceMax: job.priceMax === null ? null : Number(job.priceMax),
            currency: job.currency,
            duration: job.typicalDurationMinutes,
            categoryId: category.id,
          })),
        }
      })
      .filter(Boolean)

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Catalogue unavailable' }, { status: 500 })
  }
}
