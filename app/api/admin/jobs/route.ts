import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmAction, guardCrmRequest, getCrmCountryFilter, assertCrmCountryAllowed } from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'
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
    const guard = await guardCrmRequest(request, {
      permission: 'jobs:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const query = normalizeQuery(searchParams.get('q'))
    const source = (searchParams.get('source') || 'ALL').toUpperCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')))
    const skip = (page - 1) * limit
    const fetchWindow = skip + limit

    const statusFilter = status && status !== 'ALL' ? { status } : {}
    const countryFilter = getCrmCountryFilter(security)

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

    if (!security.isSuperAdmin) {
      if (security.assignedCountries.length === 0) {
        v1Filters.push({ id: '__NONE__' })
      } else {
        v1Filters.push({ customer: { countryCode: { in: security.assignedCountries } } })
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
    if (!['ALL', 'V1', 'V2'].includes(source)) {
      return NextResponse.json({ error: 'Invalid source filter' }, { status: 400 })
    }

    const [v1Jobs, v1Total, v2Jobs, v2Total] = await Promise.all([
      source === 'V2' ? Promise.resolve([]) : prisma.jobPosting.findMany({
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
      source === 'V2' ? Promise.resolve(0) : prisma.jobPosting.count({ where: v1Where }),
      source === 'V1' ? Promise.resolve([]) : prisma.marketplaceJob.findMany({
        where: v2Where,
        orderBy: { createdAt: 'desc' },
        take: fetchWindow,
      }),
      source === 'V1' ? Promise.resolve(0) : prisma.marketplaceJob.count({ where: v2Where }),
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
    const body = await request.json()
    const { jobId, status, source } = body

    const guard = status === 'CANCELLED'
      ? await guardCrmAction(request, 'jobs.cancel')
      : await guardCrmRequest(request, {
          permission: 'jobs:manage',
          level: 'sensitive',
          requireCountryScope: true,
        })
    if (!guard.ok) return guard.response
    const security = guard.context

    if (!jobId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const v2Statuses = ['OPEN', 'QUOTE_ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
    const v1Statuses = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
    const allowedStatuses = source === 'V2' ? v2Statuses : v1Statuses
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status for job source' }, { status: 400 })
    }

    if (source === 'V2') {
      const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }

      if (!security.isSuperAdmin) {
        if (!assertCrmCountryAllowed(security, job.countryCode || 'LK')) {
          return NextResponse.json({ error: 'Forbidden: job belongs to a different country' }, { status: 403 })
        }
      }

      try {
        const updated = await transitionMarketplaceJob(
          { jobId, actorId: security.adminId, actorType: 'STAFF' },
          status as JobStatus
        )
        await createAuditLog({
          action: 'UPDATE',
          category: 'JOB',
          userId: security.adminId,
          userEmail: security.email,
          userRole: security.role,
          entityType: 'MarketplaceJob',
          entityId: job.id,
          entityName: job.title,
          description: `CRM job status changed from ${job.status} to ${status}`,
          oldValue: { status: job.status },
          newValue: { status },
          ipAddress: security.ipAddress,
          userAgent: security.userAgent || undefined,
          riskLevel: status === 'CANCELLED' ? 'MEDIUM' : 'LOW',
        })
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

    if (!security.isSuperAdmin) {
      if (security.assignedCountries.length === 0) {
        return NextResponse.json({ error: 'No country assigned' }, { status: 403 })
      }
      if (!assertCrmCountryAllowed(security, job.customer.countryCode || 'LK')) {
        return NextResponse.json({ error: 'Forbidden: job belongs to a different country' }, { status: 403 })
      }
    }

    if (job.status === status) {
      return NextResponse.json({ job: { ...job, source: 'V1' } })
    }

    const allowedV1Transitions: Record<string, string[]> = {
      OPEN: ['ASSIGNED', 'CANCELLED'],
      ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    }
    if (!allowedV1Transitions[job.status]?.includes(status)) {
      return NextResponse.json(
        { error: `Invalid classic job transition: ${job.status} → ${status}` },
        { status: 409 }
      )
    }

    const updated = await prisma.$transaction(async tx => {
      const nextJob = await tx.jobPosting.update({
        where: { id: jobId },
        data: { status },
      })

      if (status === 'CANCELLED') {
        await tx.assignment.updateMany({
          where: {
            jobId,
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
          data: { status: 'CANCELLED' },
        })
      }

      return nextJob
    })
    await createAuditLog({
      action: 'UPDATE',
      category: 'JOB',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'JobPosting',
      entityId: job.id,
      entityName: job.title,
      description: `CRM job status changed from ${job.status} to ${status}`,
      oldValue: { status: job.status },
      newValue: { status },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: status === 'CANCELLED' ? 'MEDIUM' : 'LOW',
    })
    return NextResponse.json({ job: { ...updated, source: 'V1' } })
  } catch (error) {
    console.error('Jobs PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
  }
}
