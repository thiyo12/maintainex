import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { crmHasPermission, guardCrmRequest, getCrmCountryFilter } from '@/lib/crm/security'

const VALID_TYPES = new Set(['all', 'users', 'companies', 'jobs'])

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const query = (searchParams.get('q') || '').trim().slice(0, 120)
    const type = searchParams.get('type') || 'all'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
    const skip = (page - 1) * pageSize

    if (query.length < 2) {
      return NextResponse.json({ error: 'Search query must be at least 2 characters' }, { status: 400 })
    }

    if (!VALID_TYPES.has(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    const countryFilter = getCrmCountryFilter(security)
    const results: Record<string, unknown[]> = {}
    let total = 0

    const canUsers = crmHasPermission(security.role, 'users:view') || crmHasPermission(security.role, 'taskers:view')
    const canCompanies = crmHasPermission(security.role, 'companies:view')
    const canJobs = crmHasPermission(security.role, 'jobs:view')

    if (type === 'users' && !canUsers) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (type === 'companies' && !canCompanies) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (type === 'jobs' && !canJobs) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if ((type === 'all' || type === 'users') && canUsers) {
      const userWhere: any = {
        ...countryFilter,
        OR: [
          { id: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { mxId: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
        ],
      }
      const [users, userTotal] = await Promise.all([
        prisma.user.findMany({
          where: userWhere,
          select: {
            id: true,
            name: true,
            email: true,
            mxId: true,
            role: true,
            isSuspended: true,
            isBanned: true,
            countryCode: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: type === 'users' ? skip : 0,
          take: type === 'users' ? pageSize : 5,
        }),
        prisma.user.count({ where: userWhere }),
      ])
      results.users = users
      if (type === 'users') total = userTotal
    }

    if ((type === 'all' || type === 'companies') && canCompanies) {
      const companyWhere: any = {
        ...countryFilter,
        OR: [
          { id: { contains: query, mode: 'insensitive' } },
          { companyName: { contains: query, mode: 'insensitive' } },
          { registrationNo: { contains: query, mode: 'insensitive' } },
          { mxId: { contains: query, mode: 'insensitive' } },
        ],
      }
      const [companies, companyTotal] = await Promise.all([
        prisma.companyProfile.findMany({
          where: companyWhere,
          select: {
            id: true,
            companyName: true,
            mxId: true,
            verificationStatus: true,
            countryCode: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: type === 'companies' ? skip : 0,
          take: type === 'companies' ? pageSize : 5,
        }),
        prisma.companyProfile.count({ where: companyWhere }),
      ])
      results.companies = companies
      if (type === 'companies') total = companyTotal
    }

    if ((type === 'all' || type === 'jobs') && canJobs) {
      const jobWhere: any = {
        ...countryFilter,
        OR: [
          { id: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
        ],
      }
      const [jobs, jobTotal] = await Promise.all([
        prisma.marketplaceJob.findMany({
          where: jobWhere,
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            countryCode: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: type === 'jobs' ? skip : 0,
          take: type === 'jobs' ? pageSize : 5,
        }),
        prisma.marketplaceJob.count({ where: jobWhere }),
      ])
      results.jobs = jobs
      if (type === 'jobs') total = jobTotal
    }

    if (type === 'all') {
      total =
        (results.users?.length || 0) +
        (results.companies?.length || 0) +
        (results.jobs?.length || 0)
    }

    return NextResponse.json(
      {
        results,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    console.error('CRM search GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
