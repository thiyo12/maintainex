import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCountries } from '@/lib/locations'

export async function GET() {
  try {
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
    ].sort((a, b) => a.name.localeCompare(b.name))

    const source =
      databaseCountries.length === 0
        ? 'static-fallback'
        : fallbackCountries.length === 0
          ? 'database'
          : 'hybrid'

    return NextResponse.json({ source, countries })
  } catch (error) {
    console.error('Mobile locations GET error:', error)
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
