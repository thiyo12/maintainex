import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })


    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {}
    if (status) where.status = status

    const [jobs, total] = await Promise.all([
      prisma.marketplaceJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.marketplaceJob.count({ where }),
    ])

    return NextResponse.json({ jobs: jobs.map((j) => ({ ...j, budgetAmount: Number(j.budgetAmount) })), total, page, limit })
  } catch (error) {
    console.error('Admin jobs error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
