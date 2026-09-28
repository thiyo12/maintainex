import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/authentication/admin-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession(request)
    if (!session || !['SUPER_ADMIN', 'FINANCE', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await prisma.priceBenchmark.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Benchmark not found' }, { status: 404 })
    }

    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Cannot submit a benchmark with status ${existing.status}. Only DRAFT benchmarks can be submitted.` },
        { status: 409 }
      )
    }

    // Validate required fields for submission
    if (existing.sampleSize < 1) {
      return NextResponse.json(
        { error: 'Cannot submit a benchmark with sample size < 1' },
        { status: 400 }
      )
    }

    const benchmark = await prisma.priceBenchmark.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedBy: session.id,
        submittedAt: new Date(),
      },
    })

    return NextResponse.json({ benchmark })
  } catch (error) {
    console.error('Benchmark submit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
