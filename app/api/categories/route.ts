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

function serializeService(service: {
  id: string
  name: string
  slug: string | null
  description: string | null
  image: string | null
  price: number | null
  duration: number | null
}) {
  return {
    id: service.id,
    name: service.name,
    title: service.name,
    slug: service.slug || '',
    description: service.description || '',
    image: service.image || null,
    price: service.price === null ? null : Number(service.price),
    duration: service.duration === null ? null : Number(service.duration),
  }
}

export async function GET(request: NextRequest) {
  try {
    const country = requestCountry(request)
    const runtime = await getPlatformRuntimeConfig(country)
    if (!runtime.catalog.visible || !runtime.market.available) {
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
    }

    const categories = await prisma.category.findMany({
      where: { isActive: true, countryCode: country },
      include: {
        services: {
          where: { isActive: true, countryCode: country },
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: { services: true },
        },
      },
      orderBy: { displayOrder: 'asc' },
    })

    return NextResponse.json(
      categories.map(category => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        icon: category.icon,
        image: category.image,
        countryCode: category.countryCode,
        displayOrder: category.displayOrder,
        serviceCount: category.services.length,
        _count: { services: category.services.length },
        services: category.services.map(serializeService),
      })),
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    )
  } catch (error) {
    secureConsole.error('Public categories GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}
