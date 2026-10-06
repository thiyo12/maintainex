import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlatformRuntimeConfig } from '@/lib/runtime/platform-runtime'
import { getCountries } from '@/lib/locations'

export async function GET() {
  try {
    const runtime = await getPlatformRuntimeConfig()
    const availableMarkets = new Set(runtime.market.availableMarkets)
    const databaseCountries = await prisma.country.findMany({
      orderBy: { name: 'asc' },
      include: {
        states: {
          orderBy: { name: 'asc' },
          include: {
            cities: {
              orderBy: { name: 'asc' },
              include: {
                areas: { orderBy: { name: 'asc' } },
              },
            },
          },
        },
      },
    })

    const databaseCodes = new Set(databaseCountries.map(country => country.code))
    const fallbackCountries = getCountries()
      .filter(country => !databaseCodes.has(country.code))
      .map(country => ({ ...country, _source: 'static-fallback' as const }))

    const countries = [
      ...databaseCountries.map(country => ({ ...country, _source: 'database' as const })),
      ...fallbackCountries,
    ]
      .filter(country => availableMarkets.size === 0 || availableMarkets.has(country.code.toUpperCase()))
      .sort((a, b) => a.name.localeCompare(b.name))

    const source =
      databaseCountries.length === 0
        ? 'static-fallback'
        : fallbackCountries.length === 0
          ? 'database'
          : 'hybrid'

    return NextResponse.json({ source, countries })
  } catch (error) {
    secureConsole.error('Mobile locations GET error:', error)
    return NextResponse.json(
      {
        source: 'static-fallback',
        countries: getCountries().map(country => ({
          ...country,
          _source: 'static-fallback',
        })),
      },
      {
        status: 200,
        headers: {
          'X-MaintainEX-Location-Fallback': '1',
        },
      }
    )
  }
}
