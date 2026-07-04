import { NextRequest, NextResponse } from 'next/server'
import { searchCategories, logSearch, getPopularSearches } from '@/lib/search-engine'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const lang = (searchParams.get('lang') as 'en' | 'si' | 'ta') || 'en'
    const popular = searchParams.get('popular')

    if (popular === 'true') {
      const results = await getPopularSearches()
      return NextResponse.json({ results })
    }

    if (!q || q.trim().length === 0) {
      return NextResponse.json({ error: 'q parameter is required' }, { status: 400 })
    }

    const results = searchCategories(q.trim())

    await logSearch(null, q.trim(), null, results.length > 0 ? 0.8 : 0, null)

    return NextResponse.json({ query: q, lang, results })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Search failed' }, { status: 500 })
  }
}
