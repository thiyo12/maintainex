import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

interface UnifiedJob {
  id: string
  title: string
  description: string
  category: string
  budget: number
  budgetType: string
  location: string
  status: string
  urgency: string
  source: 'V1' | 'V2'
  customer: {
    id: string
    mxId: string | null
    name: string
    email: string
  }
  createdAt: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '15')
    const skip = (page - 1) * limit

    const where: any = {}
    if (status && status !== 'ALL') where.status = status

    // Query both V1 and V2 in parallel
    const [v1Jobs, v1Total, v2Jobs, v2Total] = await Promise.all([
      prisma.jobPosting.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              mxId: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.jobPosting.count({ where }),
      prisma.marketplaceJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.marketplaceJob.count({ where }),
    ])

    const totalCombined = v1Total + v2Total

    // Fetch related data for V2 jobs (no Prisma relations defined)
    const v2CustomerIds = [...new Set(v2Jobs.map((j) => j.customerId))]
    const v2CategoryIds = [...new Set(v2Jobs.map((j) => j.categoryId))]
    const v2AreaIds = [...new Set(v2Jobs.filter((j) => j.areaId).map((j) => j.areaId!))]

    const [v2Customers, v2Categories, v2Areas] = await Promise.all([
      v2CustomerIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: v2CustomerIds } },
            select: { id: true, mxId: true, name: true, email: true },
          })
        : [],
      v2CategoryIds.length > 0
        ? prisma.jobCategory.findMany({
            where: { id: { in: v2CategoryIds } },
            select: { id: true, name: true },
          })
        : [],
      v2AreaIds.length > 0
        ? prisma.area.findMany({
            where: { id: { in: v2AreaIds } },
            select: { id: true, name: true },
          })
        : [],
    ])

    const customerMap = new Map(v2Customers.map((c) => [c.id, c]))
    const categoryMap = new Map(v2Categories.map((c) => [c.id, c.name]))
    const areaMap = new Map(v2Areas.map((a) => [a.id, a.name]))

    // Build unified job list
    const unifiedJobs: UnifiedJob[] = []

    for (const job of v1Jobs) {
      unifiedJobs.push({
        id: job.id,
        title: job.title,
        description: job.description,
        category: job.category,
        budget: job.budget,
        budgetType: 'FIXED',
        location: job.location,
        status: job.status,
        urgency: 'NORMAL',
        source: 'V1',
        customer: job.customer,
        createdAt: job.createdAt.toISOString(),
      })
    }

    for (const job of v2Jobs) {
      const customer = customerMap.get(job.customerId)
      unifiedJobs.push({
        id: job.id,
        title: job.title,
        description: job.description,
        category: categoryMap.get(job.categoryId) || job.categoryId,
        budget: Number(job.budgetAmount),
        budgetType: job.budgetType,
        location: job.areaId ? areaMap.get(job.areaId) || job.areaId : 'Not specified',
        status: job.status,
        urgency: job.urgency,
        source: 'V2',
        customer: customer
          ? { id: customer.id, mxId: customer.mxId, name: customer.name, email: customer.email }
          : { id: job.customerId, mxId: null, name: 'Unknown', email: '' },
        createdAt: job.createdAt.toISOString(),
      })
    }

    // Sort combined by createdAt desc
    unifiedJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Paginate the combined result
    const paginatedJobs = unifiedJobs.slice(skip, skip + limit)

    return NextResponse.json({
      jobs: paginatedJobs,
      pagination: {
        page,
        limit,
        total: totalCombined,
        pages: Math.ceil(totalCombined / limit),
      },
      summary: {
        totalV1: v1Total,
        totalV2: v2Total,
      },
    })
  } catch (error) {
    console.error('Jobs GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { jobId, status, source } = body

    if (!jobId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const validStatuses = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    if (source === 'V2') {
      const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      const updated = await prisma.marketplaceJob.update({
        where: { id: jobId },
        data: { status },
      })
      return NextResponse.json({ job: { ...updated, source: 'V2' } })
    }

    // Default to V1
    const job = await prisma.jobPosting.findUnique({ where: { id: jobId } })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    const updated = await prisma.jobPosting.update({
      where: { id: jobId },
      data: { status },
    })
    return NextResponse.json({ job: { ...updated, source: 'V1' } })
  } catch (error) {
    console.error('Jobs PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
  }
}
