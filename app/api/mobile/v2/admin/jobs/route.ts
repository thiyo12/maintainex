import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCrmCountryFilter, guardCrmRequest } from '@/lib/crm/security'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'jobs:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))

    const where: any = { ...getCrmCountryFilter(security) }
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

    return NextResponse.json(
      {
        jobs: jobs.map(job => ({
          ...job,
          budgetAmount: Number(job.budgetAmount),
        })),
        total,
        page,
        limit,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Admin jobs error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
