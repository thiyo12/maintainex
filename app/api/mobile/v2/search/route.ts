import { NextRequest, NextResponse } from 'next/server'
import { aiSearch, getAutocompleteSuggestions } from '@/lib/ai-search'
import { logSearch, getPopularSearches } from '@/lib/search-engine'
import { prisma } from '@/lib/prisma'
import { getPlatformRuntimeConfig } from '@/lib/runtime/platform-runtime'
import { isCatalogAvailableInMarket } from '@/lib/domain/catalog-market-eligibility'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    if (q !== null && q.length > 160) {
      return NextResponse.json({ error: 'Search query exceeds 160 characters' }, { status: 400 })
    }
    const lang = (searchParams.get('lang') as 'en' | 'si' | 'ta') || 'en'
    const type = searchParams.get('type') || 'all'
    const popular = searchParams.get('popular')
    const suggest = searchParams.get('suggest')
    const country = searchParams.get('country')
    const runtime = await getPlatformRuntimeConfig(country)
    if (
      runtime.maintenance.enabled ||
      !runtime.channels.mobile ||
      !runtime.catalog.visible ||
      !runtime.market.available
    ) {
      return NextResponse.json({
        query: q || '',
        lang,
        categories: [],
        subServices: [],
        totalResults: 0,
        unavailable: true,
      }, { headers: { 'Cache-Control': 'no-store' } })
    }

    // Search is a discovery hint, not an authorization boundary. Nevertheless,
    // never suggest an inactive or wrong-market job. The actual booking still
    // needs the confirmed-address and provider-eligibility checks.
    const market = (country || 'LK').trim().toUpperCase()
    if (market !== 'LK' && market !== 'CA') {
      return NextResponse.json({ query: q || '', lang, categories: [], subServices: [], totalResults: 0, unavailable: true })
    }

    if (popular === 'true') {
      const results = await getPopularSearches(market)
      return NextResponse.json({ results })
    }


    const dbCategories = await prisma.jobCategory.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, name: true, countries: true },
    })
    const eligibleCategories = dbCategories.filter(c => isCatalogAvailableInMarket(c.countries, market))
    const eligibleJobs = await prisma.templateJob.findMany({
      where: { isActive: true, categoryId: { in: eligibleCategories.map(c => c.id) } },
      select: { id: true, name: true, categoryId: true, countries: true, currency: true },
    })
    const expectedCurrency = market === 'LK' ? 'LKR' : 'CAD'
    const otherMarket = market === 'LK' ? 'CA' : 'LK'
    const marketJobs = eligibleJobs.filter(j =>
      j.currency === expectedCurrency &&
      isCatalogAvailableInMarket(j.countries, market) &&
      // One TemplateJob has one priced currency. A dual-country grant must
      // not make that single-price record look bookable in either country.
      !isCatalogAvailableInMarket(j.countries, otherMarket)
    )
    // A department with zero market-priced active services is not a bookable
    // search result. Otherwise static category aliases create dead-end listings.
    const categoryIdsWithServices = new Set(marketJobs.map(j => j.categoryId))
    const availableCategories = eligibleCategories.filter(c => categoryIdsWithServices.has(c.id))
    const availableCategoryById = new Map(availableCategories.map(c => [c.id, c]))
    const bySlug = new Map(availableCategories.filter(c => c.slug).map(c => [c.slug!, c]))
    const byCategoryAndName = new Map(
      marketJobs.map(j => [j.categoryId + ':' + j.name.toLowerCase(), j]),
    )

    const results = q?.trim() ? aiSearch(q.trim()) : []
    const eligibleResults = results.filter(r => {
      const category = bySlug.get(r.categoryId)
      if (!category) return false
      return r.type === 'category' ||
        byCategoryAndName.has(category.id + ':' + (r.subServiceName || '').toLowerCase())
    })

    if (suggest === 'true' && q) {
      // The old autocomplete operated over an unscoped static dictionary.
      // Keep its ranking, but only expose names belonging to eligible jobs
      // or categories; do not leak Canada-only suggestions to LK.
      const allowedNames = new Set([
        ...availableCategories.map(c => c.name.toLowerCase()),
        ...marketJobs.map(j => j.name.toLowerCase()),
      ])
      // New approved catalogue names need not be in the historic AI keyword
      // dictionary. Use the same market-scoped DB records for autocomplete.
      const term = q.trim().toLowerCase()
      const directNames = term.length >= 2 ? [
        ...availableCategories.filter(c => c.name.toLowerCase().includes(term)).map(c => c.name),
        ...marketJobs.filter(j => j.name.toLowerCase().includes(term)).map(j => j.name),
      ] : []
      const suggestions = [...new Set([
        ...getAutocompleteSuggestions(q).filter(name => allowedNames.has(name.toLowerCase())),
        ...directNames,
      ])].slice(0, 10)
      return NextResponse.json({ query: q, suggestions })
    }

    if (!q || q.trim().length === 0) {
      return NextResponse.json({ error: 'q parameter is required' }, { status: 400 })
    }

    const categories = eligibleResults
      .filter(r => r.type === 'category')
      .map(r => ({
        id: bySlug.get(r.categoryId)!.id,
        name: r.categoryName,
        icon: r.categoryIcon,
        colorHex: r.categoryColor,
        score: r.score,
        correctedQuery: r.correctedQuery,
      }))

    const subServices = eligibleResults
      .filter(r => r.type === 'subService')
      .map(r => {
        const categoryId = bySlug.get(r.categoryId)!.id
        const job = byCategoryAndName.get(categoryId + ':' + (r.subServiceName || '').toLowerCase())!
        return {
          id: job.id,
          name: job.name,
          categoryId,
          categoryName: r.categoryName,
          categoryIcon: r.categoryIcon,
          categoryColor: r.categoryColor,
          score: r.score,
        }
      })

    // A newly approved service may not have an entry in lib/ai-search yet.
    // Preserve existing natural-language rankings, then add direct name hits
    // from ACTIVE, correctly priced, single-market catalogue records only.
    const term = q.trim().toLowerCase()
    if (term.length >= 2) {
      for (const category of availableCategories) {
        if (category.name.toLowerCase().includes(term) &&
            !categories.some(result => result.id === category.id)) {
          categories.push({
            id: category.id,
            name: category.name,
            icon: 'grid',
            colorHex: '#64748B',
            score: 90,
            correctedQuery: undefined,
          })
        }
      }
      for (const job of marketJobs) {
        if (!job.name.toLowerCase().includes(term) ||
            subServices.some(result => result.id === job.id)) continue
        const category = availableCategoryById.get(job.categoryId)
        if (!category) continue
        subServices.push({
          id: job.id,
          name: job.name,
          categoryId: category.id,
          categoryName: category.name,
          categoryIcon: 'grid',
          categoryColor: '#64748B',
          score: 90,
        })
      }
    }

    const bestMatch = eligibleResults[0]
    const correctedQuery = bestMatch?.score && bestMatch.score < 85 ? bestMatch.correctedQuery : undefined

    await logSearch(null, q.trim(), null, bestMatch?.score || categories[0]?.score || subServices[0]?.score || 0, null, market)

    return NextResponse.json({
      query: q,
      lang,
      correctedQuery,
      categories: categories.slice(0, 5),
      subServices: subServices.slice(0, 5),
      totalResults: categories.length + subServices.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
