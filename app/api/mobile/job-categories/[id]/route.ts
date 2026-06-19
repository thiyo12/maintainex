import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeParseJsonArr } from '@/lib/db-utils'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const category = await prisma.jobCategory.findFirst({
      where: { id: params.id, isActive: true },
      include: {
        jobs: { where: { isActive: true }, orderBy: [{ isPopular: 'desc' }, { name: 'asc' }] },
      },
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: category.id,
      name: category.name,
      iconName: category.iconName,
      colorHex: category.colorHex,
      sortOrder: category.sortOrder,
      countries: safeParseJsonArr(category.countries),
      jobs: category.jobs.map(j => ({
        id: j.id,
        name: j.name,
        description: j.description,
        whatIsIncluded: safeParseJsonArr(j.whatIsIncluded),
        typicalDurationMinutes: j.typicalDurationMinutes,
        priceMin: j.priceMin,
        priceMax: j.priceMax,
        currency: j.currency,
        isPopular: j.isPopular,
        isCompanyOnly: j.isCompanyOnly,
      })),
    })
  } catch (error) {
    console.error('Job category get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
