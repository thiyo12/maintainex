import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/authentication/admin-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession(request)
    if (!session || !['SUPER_ADMIN', 'FINANCE', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const benchmark = await prisma.priceBenchmark.findUnique({
      where: { id },
    })

    if (!benchmark) {
      return NextResponse.json({ error: 'Benchmark not found' }, { status: 404 })
    }

    return NextResponse.json({ benchmark })
  } catch (error) {
    console.error('Benchmark GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
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

    if (existing.status === 'PUBLISHED' || existing.status === 'SUPERSEDED') {
      return NextResponse.json(
        { error: 'Cannot modify a published or superseded benchmark. Create a new version instead.' },
        { status: 409 }
      )
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.sampleSize !== undefined) data.sampleSize = body.sampleSize
    if (body.medianAmountCents !== undefined) data.medianAmountCents = BigInt(body.medianAmountCents)
    if (body.lowerPercentileCents !== undefined) data.lowerPercentileCents = BigInt(body.lowerPercentileCents)
    if (body.upperPercentileCents !== undefined) data.upperPercentileCents = BigInt(body.upperPercentileCents)
    if (body.minimumObservedCents !== undefined) data.minimumObservedCents = BigInt(body.minimumObservedCents)
    if (body.maximumObservedCents !== undefined) data.maximumObservedCents = BigInt(body.maximumObservedCents)
    if (body.sourceType !== undefined) data.sourceType = body.sourceType
    if (body.sourceReference !== undefined) data.sourceReference = body.sourceReference
    if (body.methodologyNote !== undefined) data.methodologyNote = body.methodologyNote
    if (body.effectiveFrom !== undefined) data.effectiveFrom = body.effectiveFrom ? new Date(body.effectiveFrom) : null
    if (body.effectiveTo !== undefined) data.effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null

    const benchmark = await prisma.priceBenchmark.update({ where: { id }, data })

    return NextResponse.json({ benchmark })
  } catch (error) {
    console.error('Benchmark PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
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

    if (existing.status === 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Cannot delete a published benchmark. Supersede it instead.' },
        { status: 409 }
      )
    }

    await prisma.priceBenchmark.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Benchmark DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
