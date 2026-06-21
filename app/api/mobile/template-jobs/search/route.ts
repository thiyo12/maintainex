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
    const query = searchParams.get('q') || ''

    if (!query.trim()) {
      return NextResponse.json([])
    }

    const jobs = await prisma.templateJob.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query } },
          { description: { contains: query } },
        ],
      },
      include: { category: true },
      take: 20,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(jobs.map(j => ({
      id: j.id,
      categoryId: j.categoryId,
      name: j.name,
      description: j.description,
      typicalDurationMinutes: j.typicalDurationMinutes,
      priceMin: j.priceMin,
      priceMax: j.priceMax,
      currency: j.currency,
      isPopular: j.isPopular,
      category: {
        id: j.category.id,
        name: j.category.name,
        iconName: j.category.iconName,
        colorHex: j.category.colorHex,
      },
    })))
  } catch (error) {
    console.error('Template jobs search error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
