import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isCatalogAvailableInMarket } from '@/lib/domain/catalog-market-eligibility'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const market = (searchParams.get('country') || 'LK').trim().toUpperCase()
    if (market !== 'LK' && market !== 'CA') {
      return NextResponse.json({ error: 'Unsupported market' }, { status: 400 })
    }
    if (query.length > 160) {
      return NextResponse.json({ error: 'Search query exceeds 160 characters' }, { status: 400 })
    }

    if (!query.trim()) {
      return NextResponse.json([])
    }

    const expectedCurrency = market === 'LK' ? 'LKR' : 'CAD'
    const jobs = await prisma.templateJob.findMany({
      where: {
        isActive: true,
        currency: expectedCurrency,
        category: { is: { isActive: true } },
        OR: [
          { name: { contains: query } },
          { description: { contains: query } },
        ],
      },
      include: { category: true },
      take: 200,
      orderBy: { name: 'asc' },
    })

    const eligible = jobs.filter(j => j.currency === expectedCurrency && j.category.isActive &&
      isCatalogAvailableInMarket(j.countries, market) &&
      isCatalogAvailableInMarket(j.category.countries, market))

    return NextResponse.json(eligible.slice(0, 20).map(j => ({
      id: j.id,
      categoryId: j.categoryId,
      name: j.name,
      description: j.description,
      typicalDurationMinutes: j.typicalDurationMinutes,
      priceMin: j.priceMin,
      priceMax: j.priceMax,
      currency: j.currency,
      isPopular: j.isPopular,
      category: {
        id: j.category.id,
        name: j.category.name,
        iconName: j.category.iconName,
        colorHex: j.category.colorHex,
      },
    })))
  } catch (error) {
    secureConsole.error('Template jobs search error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
