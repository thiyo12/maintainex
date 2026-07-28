import { NextRequest, NextResponse } from 'next/server'
import { aiSearch, getAutocompleteSuggestions } from '@/lib/ai-search'
import { logSearch, getPopularSearches } from '@/lib/search-engine'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const lang = (searchParams.get('lang') as 'en' | 'si' | 'ta') || 'en'
    const type = searchParams.get('type') || 'all'
    const popular = searchParams.get('popular')
    const suggest = searchParams.get('suggest')

    if (popular === 'true') {
      const results = await getPopularSearches()
      return NextResponse.json({ results })
    }

    if (suggest === 'true' && q) {
      const suggestions = getAutocompleteSuggestions(q)
      return NextResponse.json({ query: q, suggestions })
    }

    if (!q || q.trim().length === 0) {
      return NextResponse.json({ error: 'q parameter is required' }, { status: 400 })
    }

    const results = aiSearch(q.trim())

    const categories = results
      .filter(r => r.type === 'category')
      .map(r => ({
        id: r.categoryId,
        name: r.categoryName,
        icon: r.categoryIcon,
        colorHex: r.categoryColor,
        score: r.score,
        correctedQuery: r.correctedQuery,
      }))

    const subServices = results
      .filter(r => r.type === 'subService')
      .map(r => ({
        id: r.subServiceId,
        name: r.subServiceName,
        categoryId: r.categoryId,
        categoryName: r.categoryName,
        categoryIcon: r.categoryIcon,
        categoryColor: r.categoryColor,
        score: r.score,
      }))

    const bestMatch = results[0]
    const correctedQuery = bestMatch?.score && bestMatch.score < 85 ? bestMatch.correctedQuery : undefined

    await logSearch(null, q.trim(), null, bestMatch?.score || 0, null)

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
