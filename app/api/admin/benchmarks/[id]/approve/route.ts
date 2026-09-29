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

    if (existing.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: `Cannot approve a benchmark with status ${existing.status}. Only SUBMITTED benchmarks can be approved.` },
        { status: 409 }
      )
    }

    const benchmark = await prisma.priceBenchmark.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: session.id,
        approvedAt: new Date(),
      },
    })

    return NextResponse.json({ benchmark })
  } catch (error) {
    console.error('Benchmark approve error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
