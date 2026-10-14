import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlatformRuntimeConfig } from '@/lib/runtime/platform-runtime'
import { requestCountry } from '@/lib/api/request-country'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const country = requestCountry(request)
    const runtime = await getPlatformRuntimeConfig(country)

    if (!runtime.offers.visible || !runtime.market.available) {
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
    }

    const season = searchParams.get('season')
    const offers = await prisma.seasonalOffer.findMany({
      where: {
        isActive: true,
        country,
        ...(season ? { season } : {}),
      },
      include: {
        jobs: {
          include: {
            templateJob: {
              include: { category: true },
            },
          },
          orderBy: { templateJob: { name: 'asc' } },
        },
      },
      orderBy: { displayOrder: 'asc' },
    })

    return NextResponse.json(offers, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    secureConsole.error('Public seasonal offers GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch seasonal offers' }, { status: 500 })
  }
}
