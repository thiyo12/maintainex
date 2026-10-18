import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlatformRuntimeConfig } from '@/lib/runtime/platform-runtime'
import { isCatalogAvailableInMarket, isBookNowCatalogueAvailableInMarket } from '@/lib/domain/catalog-market-eligibility'

function parseQuestions(questionsJson: string | null | undefined): any[] {
  if (!questionsJson) return []
  try {
    const parsed = JSON.parse(questionsJson)
    if (Array.isArray(parsed)) return parsed
    if (parsed && Array.isArray(parsed.questions)) return parsed.questions
    return []
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobCategoryId = searchParams.get('jobCategoryId')
    const slug = searchParams.get('slug')
    const country = (searchParams.get('country') || 'LK').trim().toUpperCase()
    if (country !== 'LK' && country !== 'CA') {
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
    }
    const runtime = await getPlatformRuntimeConfig(country)
    if (
      runtime.maintenance.enabled ||
      !runtime.channels.mobile ||
      !runtime.catalog.visible ||
      !runtime.market.available
    ) {
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
    }

    const where: any = { isActive: true, countryCode: country }
    if (jobCategoryId) where.jobCategoryId = jobCategoryId
    if (slug) where.slug = slug

    const templates = await prisma.serviceTemplate.findMany({
      where,
      include: {
        jobCategory: { select: { id: true, name: true, slug: true, isActive: true, countries: true } },
        templateJob: { select: { id: true, name: true, typicalDurationMinutes: true, priceMin: true, priceMax: true, isActive: true, countries: true, currency: true } },
      },
      orderBy: { sortOrder: 'asc' },
    })

    const expectedCurrency = country === 'CA' ? 'CAD' : 'LKR'
    // A service-template country tag alone is insufficient for bookability.
    // The active parent category and any linked TemplateJob must authorize
    // the same market/currency, exactly as in direct booking.
    const bookableTemplates = templates.filter(t =>
      t.currency === expectedCurrency &&
      t.jobCategory?.isActive === true &&
      isCatalogAvailableInMarket(t.jobCategory.countries, country) &&
      (!t.templateJob ||
        isBookNowCatalogueAvailableInMarket(t.templateJob, t.jobCategory, country))
    )

    return NextResponse.json(
      bookableTemplates.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        description: t.description,
        jobCategory: t.jobCategory,
        questions: parseQuestions(t.questionsJson),
        defaultDurationMinutes: t.defaultDurationMinutes,
        priceMin: t.priceMin,
        priceMax: t.priceMax,
        currency: t.currency,
        refJob: t.templateJob
          ? {
              id: t.templateJob.id,
              name: t.templateJob.name,
              durationMinutes: t.templateJob.typicalDurationMinutes,
              priceMin: t.templateJob.priceMin,
              priceMax: t.templateJob.priceMax,
            }
          : null,
      }))
    )
  } catch (error) {
    secureConsole.error('Service templates error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
