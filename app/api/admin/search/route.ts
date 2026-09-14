import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { getCountryFilter } from '@/lib/admin-rbac'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'MANAGER', 'USER_MANAGEMENT', 'SUPPORT', 'FINANCE', 'TECHNICAL']

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') || 'all'
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const skip = (page - 1) * pageSize

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ error: 'Search query must be at least 2 characters' }, { status: 400 })
    }

    const countryFilter = getCountryFilter(session)
    const results: Record<string, unknown[]> = {}
    let total = 0

    if (type === 'all' || type === 'users') {
      const userWhere = {
        ...countryFilter,
        OR: [
          { name: { contains: query } },
          { email: { contains: query } },
          { mxId: { contains: query } },
          { phone: { contains: query } },
        ],
      }
      const [users, userTotal] = await Promise.all([
        prisma.user.findMany({
          where: userWhere,
          select: { id: true, name: true, email: true, mxId: true, role: true, isSuspended: true, isBanned: true, countryCode: true },
          orderBy: { createdAt: 'desc' },
          skip: type === 'users' ? skip : 0,
          take: type === 'users' ? pageSize : 5,
        }),
        prisma.user.count({ where: userWhere }),
      ])
      results.users = users
      if (type === 'users') total = userTotal
    }

    if (type === 'all' || type === 'companies') {
      const companyWhere = {
        ...countryFilter,
        OR: [
          { companyName: { contains: query } },
          { registrationNo: { contains: query } },
          { mxId: { contains: query } },
        ],
      }
      const [companies, companyTotal] = await Promise.all([
        prisma.companyProfile.findMany({
          where: companyWhere,
          select: { id: true, companyName: true, mxId: true, verificationStatus: true, countryCode: true },
          orderBy: { createdAt: 'desc' },
          skip: type === 'companies' ? skip : 0,
          take: type === 'companies' ? pageSize : 5,
        }),
        prisma.companyProfile.count({ where: companyWhere }),
      ])
      results.companies = companies
      if (type === 'companies') total = companyTotal
    }

    if (type === 'all' || type === 'jobs') {
      const jobWhere = {
        OR: [
          { title: { contains: query } },
          { id: { contains: query } },
        ],
      }
      const [jobs, jobTotal] = await Promise.all([
        prisma.marketplaceJob.findMany({
          where: jobWhere,
          select: { id: true, title: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          skip: type === 'jobs' ? skip : 0,
          take: type === 'jobs' ? pageSize : 5,
        }),
        prisma.marketplaceJob.count({ where: jobWhere }),
      ])
      results.jobs = jobs
      if (type === 'jobs') total = jobTotal
    }

    if (type !== 'all' && type !== 'users' && type !== 'companies' && type !== 'jobs') {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    if (type === 'all') {
      total = (results.users?.length || 0) + (results.companies?.length || 0) + (results.jobs?.length || 0)
    }

    return NextResponse.json({
      results,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('Search GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
