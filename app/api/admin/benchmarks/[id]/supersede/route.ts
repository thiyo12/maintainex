import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession(request)
    if (!session || !['SUPER_ADMIN', 'FINANCE'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await prisma.priceBenchmark.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Benchmark not found' }, { status: 404 })
    }

    if (existing.status !== 'PUBLISHED') {
      return NextResponse.json(
        { error: `Cannot supersede a benchmark with status ${existing.status}. Only PUBLISHED benchmarks can be superseded.` },
        { status: 409 }
      )
    }

    // Mark the current benchmark as superseded
    const [superseded, newBenchmark] = await prisma.$transaction([
      prisma.priceBenchmark.update({
        where: { id },
        data: { status: 'SUPERSEDED', effectiveTo: new Date() },
      }),
      prisma.priceBenchmark.create({
        data: {
          serviceTemplateId: existing.serviceTemplateId,
          countryCode: existing.countryCode,
          region: existing.region,
          city: existing.city,
          currency: existing.currency,
          pricingMode: existing.pricingMode,
          sampleSize: 0,
          medianAmountCents: existing.medianAmountCents,
          lowerPercentileCents: existing.lowerPercentileCents,
          upperPercentileCents: existing.upperPercentileCents,
          minimumObservedCents: existing.minimumObservedCents,
          maximumObservedCents: existing.maximumObservedCents,
          sourceType: existing.sourceType,
          sourceReference: existing.sourceReference,
          methodologyNote: existing.methodologyNote,
          geographyLevel: existing.geographyLevel,
          status: 'DRAFT',
          version: existing.version + 1,
          createdBy: session.id,
          supersededFromId: id,
        },
      }),
    ])

    return NextResponse.json({
      superseded,
      newBenchmark,
      message: `Benchmark superseded. New draft v${newBenchmark.version} created.`,
    })
  } catch (error) {
    console.error('Benchmark supersede error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
