import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/authentication/admin-auth'
import { getCountryFilter } from '@/lib/auth/authorization/admin-rbac'
import { transitionMarketplaceJob, type JobStatus } from '@/lib/domain/job-lifecycle'

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

function normalizeQuery(value: string | null): string | null {
  const query = value?.trim()
  return query ? query.slice(0, 120) : null
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !['SUPER_ADMIN', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const query = normalizeQuery(searchParams.get('q'))
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')))
    const skip = (page - 1) * limit
    const fetchWindow = skip + limit

    const statusFilter = status && status !== 'ALL' ? { status } : {}
    const countryFilter = getCountryFilter(session)

    let matchingV2CustomerIds: string[] = []
    if (query) {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { id: { contains: query, mode: 'insensitive' } },
            { mxId: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 250,
      })
      matchingV2CustomerIds = users.map(user => user.id)
    }

    const v2Where: any = {
      ...statusFilter,
      ...countryFilter,
      ...(query
        ? {
            OR: [
              { id: { contains: query, mode: 'insensitive' } },
              { title: { contains: query, mode: 'insensitive' } },
              ...(matchingV2CustomerIds.length > 0 ? [{ customerId: { in: matchingV2CustomerIds } }] : []),
            ],
          }
        : {}),
    }

    const v1Filters: any[] = []
    if (status && status !== 'ALL') v1Filters.push({ status })

    if (session.role !== 'SUPER_ADMIN') {
      if (session.assignedCountries.length === 0) {
        v1Filters.push({ id: '__NONE__' })
      } else {
        v1Filters.push({ customer: { countryCode: { in: session.assignedCountries } } })
      }
    }

    if (query) {
      v1Filters.push({
        OR: [
          { id: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
          { customer: { name: { contains: query, mode: 'insensitive' } } },
          { customer: { email: { contains: query, mode: 'insensitive' } } },
          { customer: { mxId: { contains: query, mode: 'insensitive' } } },
        ],
      })
    }

    const v1Where: any = v1Filters.length > 0 ? { AND: v1Filters } : {}

    // Pull only the leading window needed for the requested combined page.
    // Fetching each source from offset 0 avoids the previous double-offset bug
    // where page > 1 skipped records once in each table and then again after merge.
    const [v1Jobs, v1Total, v2Jobs, v2Total] = await Promise.all([
      prisma.jobPosting.findMany({
        where: v1Where,
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
        take: fetchWindow,
      }),
      prisma.jobPosting.count({ where: v1Where }),
      prisma.marketplaceJob.findMany({
        where: v2Where,
        orderBy: { createdAt: 'desc' },
        take: fetchWindow,
      }),
      prisma.marketplaceJob.count({ where: v2Where }),
    ])

    const totalCombined = v1Total + v2Total

    const v2CustomerIds = [...new Set(v2Jobs.map(job => job.customerId))]
    const v2CategoryIds = [...new Set(v2Jobs.map(job => job.categoryId))]
    const v2AreaIds = [...new Set(v2Jobs.filter(job => job.areaId).map(job => job.areaId!))]

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

    const customerMap = new Map(v2Customers.map(customer => [customer.id, customer]))
    const categoryMap = new Map(v2Categories.map(category => [category.id, category.name]))
    const areaMap = new Map(v2Areas.map(area => [area.id, area.name]))

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
        budget: Number(job.budgetAmount || 0),
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

    unifiedJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const paginatedJobs = unifiedJobs.slice(skip, skip + limit)
    const pages = Math.max(1, Math.ceil(totalCombined / limit))

    return NextResponse.json({
      jobs: paginatedJobs,
      total: totalCombined,
      page,
      limit,
      totalPages: pages,
      pagination: {
        page,
        limit,
        total: totalCombined,
        pages,
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
    if (!session || !['SUPER_ADMIN', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { jobId, status, source } = body

    if (!jobId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const validStatuses = ['OPEN', 'QUOTE_ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    if (source === 'V2') {
      const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }

      if (session.role !== 'SUPER_ADMIN') {
        const countryFilter = getCountryFilter(session)
        if (countryFilter.id === '__NONE__') {
          return NextResponse.json({ error: 'No country assigned' }, { status: 403 })
        }
        if (countryFilter.countryCode && !countryFilter.countryCode.in?.includes(job.countryCode || 'LK')) {
          return NextResponse.json({ error: 'Forbidden: job belongs to a different country' }, { status: 403 })
        }
      }

      try {
        const updated = await transitionMarketplaceJob(
          { jobId, actorId: session.adminUserId, actorType: 'STAFF' },
          status as JobStatus
        )
        return NextResponse.json({ job: { ...updated, source: 'V2' } })
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Transition failed' },
          { status: 400 }
        )
      }
    }

    const job = await prisma.jobPosting.findUnique({
      where: { id: jobId },
      include: {
        customer: {
          select: { countryCode: true },
        },
      },
    })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (session.role !== 'SUPER_ADMIN') {
      if (session.assignedCountries.length === 0) {
        return NextResponse.json({ error: 'No country assigned' }, { status: 403 })
      }
      if (!session.assignedCountries.includes(job.customer.countryCode || 'LK')) {
        return NextResponse.json({ error: 'Forbidden: job belongs to a different country' }, { status: 403 })
      }
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
