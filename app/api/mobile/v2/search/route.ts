import { NextRequest, NextResponse } from 'next/server'
import { aiSearch, getAutocompleteSuggestions } from '@/lib/ai-search'
import { logSearch, getPopularSearches } from '@/lib/search-engine'
import { prisma } from '@/lib/prisma'
import { getPlatformRuntimeConfig } from '@/lib/runtime/platform-runtime'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
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

    const marketEnabled = (stored: string): boolean => {
      try {
        const countries: unknown = JSON.parse(stored)
        return Array.isArray(countries) && countries.includes(market)
      } catch {
        return false
      }
    }

    const dbCategories = await prisma.jobCategory.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, name: true, countries: true },
    })
    const eligibleCategories = dbCategories.filter(c => marketEnabled(c.countries))
    const bySlug = new Map(eligibleCategories.filter(c => c.slug).map(c => [c.slug!, c]))
    const eligibleJobs = await prisma.templateJob.findMany({
      where: { isActive: true, categoryId: { in: eligibleCategories.map(c => c.id) } },
      select: { id: true, name: true, categoryId: true, countries: true },
    })
    const byCategoryAndName = new Map(
      eligibleJobs.filter(j => marketEnabled(j.countries))
        .map(j => [j.categoryId + ':' + j.name.toLowerCase(), j]),
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
        ...eligibleCategories.map(c => c.name.toLowerCase()),
        ...eligibleJobs.filter(j => marketEnabled(j.countries)).map(j => j.name.toLowerCase()),
      ])
      const suggestions = getAutocompleteSuggestions(q).filter(name => allowedNames.has(name.toLowerCase()))
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

    const bestMatch = eligibleResults[0]
    const correctedQuery = bestMatch?.score && bestMatch.score < 85 ? bestMatch.correctedQuery : undefined

    await logSearch(null, q.trim(), null, bestMatch?.score || 0, null, market)

    return NextResponse.json({
      query: q,
      lang,
      correctedQuery,
      categories: categories.slice(0, 5),
      subServices: subServices.slice(0, 5),
      totalResults: categories.length + subServices.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Search failed' }, { status: 500 })
  }
}
