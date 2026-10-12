import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeParseJsonArr } from '@/lib/db-utils'
import { isCatalogAvailableInMarket } from '@/lib/domain/catalog-market-eligibility'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const country = (searchParams.get('country') || 'LK').trim().toUpperCase()
    if (country !== 'LK' && country !== 'CA') {
      return NextResponse.json({ error: 'Unsupported market' }, { status: 400 })
    }

    const where: any = { isActive: true }
    if (categoryId) where.categoryId = categoryId

    let jobs = await prisma.templateJob.findMany({
      where,
      include: { category: true },
      orderBy: [{ isPopular: 'desc' }, { name: 'asc' }],
    })

    jobs = jobs.filter(j => j.category.isActive &&
      isCatalogAvailableInMarket(j.countries, country) &&
      isCatalogAvailableInMarket(j.category.countries, country))

    return NextResponse.json(jobs.map(j => ({
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
      category: {
        id: j.category.id,
        name: j.category.name,
        iconName: j.category.iconName,
        colorHex: j.category.colorHex,
      },
    })))
  } catch (error) {
    secureConsole.error('Template jobs list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
