import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeParseJsonArr, storedListIncludes } from '@/lib/db-utils'
import { getPlatformRuntimeConfig } from '@/lib/runtime/platform-runtime'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const country = (searchParams.get('country') || 'LK').trim().toUpperCase()
    const runtime = await getPlatformRuntimeConfig(country)
    if (
      runtime.maintenance.enabled ||
      !runtime.channels.mobile ||
      !runtime.catalog.visible ||
      !runtime.market.available
    ) {
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
    }

    const allCategories = await prisma.jobCategory.findMany({
      where: { isActive: true },
      include: {
        jobs: {
          where: { isActive: true },
          select: { id: true, name: true, description: true, priceMin: true, priceMax: true, currency: true, isPopular: true, countries: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    const categories = allCategories
      .filter(category => storedListIncludes(category.countries, country))
      .map(category => ({
        ...category,
        countries: safeParseJsonArr(category.countries),
        jobs: category.jobs
          .filter(job => storedListIncludes(job.countries, country))
          .map(job => ({
            ...job,
            countries: safeParseJsonArr(job.countries),
          })),
      }))

    return NextResponse.json(categories, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (error) {
    console.error('Error fetching service categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}
