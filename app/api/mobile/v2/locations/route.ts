import { secureConsole } from '@/lib/shared/observability/secure-console'
import { getMarketConfig } from '@/lib/geography/market-engine'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlatformRuntimeConfig } from '@/lib/runtime/platform-runtime'
import { getCountries } from '@/lib/locations'

export async function GET() {
  // Preserve runtime market restrictions if the country-table query fails.
  // If runtime permissions themselves cannot be read, fail closed instead of
  // revealing stale or disabled locations from the historical static dataset.
  let availableMarkets: Set<string> | null = null
  try {
    const runtime = await getPlatformRuntimeConfig()
    availableMarkets = new Set(runtime.market.availableMarkets)
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
      // Historical database/fallback rows may still contain Toronto and other
      // markets. Only configured LK and City of Vancouver launch markets may
      // appear in the address picker, even with an empty runtime allowlist.
      .filter(country => getMarketConfig(country.code) !== null)
      .filter(country => availableMarkets!.size === 0 || availableMarkets!.has(country.code.toUpperCase()))
      .map(country => restrictToLaunchMarket(country))
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
        source: availableMarkets ? 'static-fallback' : 'unavailable',
        countries: availableMarkets
          ? getCountries()
              .filter(country => getMarketConfig(country.code) !== null)
              .filter(country => availableMarkets!.size === 0 || availableMarkets!.has(country.code.toUpperCase()))
              .map(country => restrictToLaunchMarket({
                ...country,
                _source: 'static-fallback' as const,
              }))
          : [],
      },
      {
        status: availableMarkets ? 200 : 503,
        headers: {
          'X-MaintainEX-Location-Fallback': '1',
        },
      }
    )
  }
}

type CountryWithRegions = {
  code: string
  states?: Array<{ name: string; cities?: Array<{ name: string; areas?: Array<{ name: string }> }> }>
}

/**
 * Phase 02: only locations inside a launch market may be offered. Canada is
 * restricted to the City of Vancouver, so neighbouring municipalities must
 * never appear in the address picker even when present in the database.
 */
function restrictToLaunchMarket<T extends CountryWithRegions>(country: T): T {
  const market = getMarketConfig(country.code)
  if (!market || !country.states) return country

  const allowed = new Set(market.districts.map(district => district.toLowerCase()))
  return {
    ...country,
    states: country.states
      .map(state => ({
        ...state,
        cities: (state.cities || [])
          .filter(city => allowed.has(city.name.toLowerCase()))
          .map(city => {
            // The UBC main campus lies in Metro Vancouver Electoral Area A,
            // outside the City of Vancouver municipal launch boundary.
            // Preserve historical records but do not offer this area for a
            // newly selected Vancouver service address.
            if (country.code.toUpperCase() !== 'CA') return city
            return {
              ...city,
              areas: city.areas?.filter(area => area.name.trim().toLowerCase() !== 'ubc'),
            }
          }),
      }))
      // Only the City of Vancouver in British Columbia is in the CA launch
      // scope. Never display a same-named city from Ontario or another province.
      .filter(state =>
        (state.cities || []).length > 0 &&
        (country.code.toUpperCase() !== 'CA' ||
          ['british columbia', 'bc'].includes(state.name.trim().toLowerCase()))
      ),
  } as T
}
