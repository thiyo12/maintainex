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
    const categoryId = searchParams.get('categoryId')
    const country = searchParams.get('country') || 'LK'

    const where: any = { isActive: true, countries: { has: country } }
    if (categoryId) where.categoryId = categoryId

    const jobs = await prisma.templateJob.findMany({
      where,
      include: { category: true },
      orderBy: [{ isPopular: 'desc' }, { name: 'asc' }],
    })

    return NextResponse.json(jobs.map(j => ({
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
      category: {
        id: j.category.id,
        name: j.category.name,
        iconName: j.category.iconName,
        colorHex: j.category.colorHex,
      },
    })))
  } catch (error) {
    console.error('Template jobs list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
