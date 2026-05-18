import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country') || 'LK'

    const categories = await prisma.jobCategory.findMany({
      where: { isActive: true, countries: { has: country } },
      include: {
        jobs: { where: { isActive: true }, orderBy: { name: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json(categories.map(c => ({
      id: c.id,
      name: c.name,
      iconName: c.iconName,
      colorHex: c.colorHex,
      sortOrder: c.sortOrder,
      countries: c.countries,
      isActive: c.isActive,
      jobs: c.jobs.map(j => ({
        id: j.id,
        categoryId: j.categoryId,
        name: j.name,
        description: j.description,
        whatIsIncluded: j.whatIsIncluded,
        typicalDurationMinutes: j.typicalDurationMinutes,
        priceMin: j.priceMin,
        priceMax: j.priceMax,
        currency: j.currency,
        isPopular: j.isPopular,
        isCompanyOnly: j.isCompanyOnly,
        countries: j.countries,
      })),
    })))
  } catch (error) {
    console.error('Job categories list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
