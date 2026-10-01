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
        jobs: { where: { isActive: true }, orderBy: { name: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    })

    const categories = allCategories.filter(c => storedListIncludes(c.countries, country))

    return NextResponse.json(categories.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      iconName: c.iconName,
      colorHex: c.colorHex,
      sortOrder: c.sortOrder,
      countries: safeParseJsonArr(c.countries),
      isActive: c.isActive,
      jobs: c.jobs.map(j => ({
        id: j.id,
        categoryId: j.categoryId,
        name: j.name,
        description: j.description,
        whatIsIncluded: safeParseJsonArr(j.whatIsIncluded),
        typicalDurationMinutes: j.typicalDurationMinutes,
        priceMin: j.priceMin,
        priceMax: j.priceMax,
        currency: j.currency,
        isPopular: j.isPopular,
        isCompanyOnly: j.isCompanyOnly,
        countries: safeParseJsonArr(j.countries),
      })),
    })))
  } catch (error) {
    console.error('Job categories list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
