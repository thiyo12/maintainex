import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const locations = await prisma.propertyLocation.findMany({
      where: { isActive: true },
      orderBy: [{ countryCode: 'asc' }, { district: 'asc' }, { city: 'asc' }],
    })

    return NextResponse.json({ success: true, data: locations })
  } catch (error: any) {
    console.error('Error fetching locations:', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch locations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { countryCode, district, city, area } = body

    if (!countryCode || !district || !city) {
      return NextResponse.json({ error: 'Country, district, and city are required' }, { status: 400 })
    }

    const existing = await prisma.propertyLocation.findFirst({
      where: { countryCode, district, city, area: area || null },
    })

    if (existing) {
      return NextResponse.json({ error: 'Location already exists' }, { status: 400 })
    }

    const location = await prisma.propertyLocation.create({
      data: { countryCode, district, city, area: area || null },
    })

    return NextResponse.json({ success: true, data: location }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating location:', error)
    return NextResponse.json({ error: error?.message || 'Failed to create location' }, { status: 500 })
  }
}
