import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlatformRuntimeConfig } from '@/lib/runtime/platform-runtime'
import { getRegionFromHost } from '@/lib/regions'

function requestCountry(request: NextRequest): string {
  const requested = new URL(request.url).searchParams.get('country')?.trim().toUpperCase()
  if (requested && /^[A-Z]{2}$/.test(requested)) return requested
  return getRegionFromHost(request.headers.get('host') || '')
}

function serializeService(service: any) {
  return {
    ...service,
    title: service.name,
    price: service.price === null ? null : Number(service.price),
    duration: service.duration === null ? null : Number(service.duration),
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categorySlug = searchParams.get('category')
    const includeReviews = searchParams.get('reviews') === 'true'
    const country = requestCountry(request)
    const runtime = await getPlatformRuntimeConfig(country)

    if (!runtime.catalog.visible || !runtime.market.available) {
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
    }

    const where: any = {
      isActive: true,
      countryCode: country,
    }
    if (categorySlug) {
      where.category = { slug: categorySlug, countryCode: country }
    }

    const services = await prisma.service.findMany({
      where,
      include: {
        category: true,
        reviews: includeReviews
          ? { where: { status: 'APPROVED' } }
          : false,
      },
      orderBy: [
        { category: { displayOrder: 'asc' } },
        { displayOrder: 'asc' },
      ],
    })

    return NextResponse.json(services.map(serializeService), {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error) {
    secureConsole.error('Public services GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
  }
}
