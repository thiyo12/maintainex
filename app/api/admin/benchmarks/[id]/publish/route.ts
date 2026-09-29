import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/authentication/admin-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession(request)
    if (!session || !['SUPER_ADMIN'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await prisma.priceBenchmark.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Benchmark not found' }, { status: 404 })
    }

    if (existing.status !== 'APPROVED') {
      return NextResponse.json(
        { error: `Cannot publish a benchmark with status ${existing.status}. Only APPROVED benchmarks can be published.` },
        { status: 409 }
      )
    }

    // Supersede any existing published benchmark for the same geography
    if (existing.geographyLevel === 'CITY' && existing.city) {
      await prisma.priceBenchmark.updateMany({
        where: {
          serviceTemplateId: existing.serviceTemplateId,
          countryCode: existing.countryCode,
          region: existing.region,
          city: existing.city,
          status: 'PUBLISHED',
          id: { not: id },
        },
        data: { status: 'SUPERSEDED' },
      })
    } else if (existing.geographyLevel === 'PROVINCE' && existing.region) {
      await prisma.priceBenchmark.updateMany({
        where: {
          serviceTemplateId: existing.serviceTemplateId,
          countryCode: existing.countryCode,
          region: existing.region,
          city: null,
          status: 'PUBLISHED',
          id: { not: id },
        },
        data: { status: 'SUPERSEDED' },
      })
    } else {
      await prisma.priceBenchmark.updateMany({
        where: {
          serviceTemplateId: existing.serviceTemplateId,
          countryCode: existing.countryCode,
          region: null,
          city: null,
          status: 'PUBLISHED',
          id: { not: id },
        },
        data: { status: 'SUPERSEDED' },
      })
    }

    const benchmark = await prisma.priceBenchmark.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        effectiveFrom: existing.effectiveFrom ?? new Date(),
      },
    })

    return NextResponse.json({ benchmark })
  } catch (error) {
    console.error('Benchmark publish error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
