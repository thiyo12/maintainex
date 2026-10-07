import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeParseJsonArr } from '@/lib/db-utils'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const job = await prisma.templateJob.findFirst({
      where: { id, isActive: true },
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
      whatIsIncluded: safeParseJsonArr(job.whatIsIncluded),
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
    secureConsole.error('Template job get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
