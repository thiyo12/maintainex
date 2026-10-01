import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCountries } from '@/lib/locations'

export async function GET() {
  try {
    const countries = await prisma.country.findMany({
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

    if (countries.length > 0) {
      return NextResponse.json({
        source: 'database',
        countries,
      })
    }

    return NextResponse.json({
      source: 'static-fallback',
      countries: getCountries(),
    })
  } catch (error) {
    console.error('Mobile locations GET error:', error)
    return NextResponse.json(
      {
        source: 'static-fallback',
        countries: getCountries(),
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
