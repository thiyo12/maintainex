import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const job = await prisma.templateJob.findFirst({
      where: { id: params.id, isActive: true },
      include: { category: true },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: job.id,
      categoryId: job.categoryId,
      name: job.name,
      description: job.description,
      whatIsIncluded: job.whatIsIncluded,
      typicalDurationMinutes: job.typicalDurationMinutes,
      priceMin: job.priceMin,
      priceMax: job.priceMax,
      currency: job.currency,
      isPopular: job.isPopular,
      isCompanyOnly: job.isCompanyOnly,
      category: {
        id: job.category.id,
        name: job.category.name,
        iconName: job.category.iconName,
        colorHex: job.category.colorHex,
      },
    })
  } catch (error) {
    console.error('Template job get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
