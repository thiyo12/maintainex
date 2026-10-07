import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmRequest, getCrmCountryFilter } from '@/lib/crm/security'
import { evaluateEffectivePermission } from '@/lib/crm/governance'

const VALID_TYPES = new Set(['all', 'users', 'companies', 'jobs', 'disputes', 'payments', 'listings'])

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

    const requestedMarket = (searchParams.get('market') || 'ALL').trim().toUpperCase()
    if (requestedMarket !== 'ALL' && !/^[A-Z]{2}$/.test(requestedMarket)) {
      return NextResponse.json({ error: 'Invalid market' }, { status: 400 })
    }
    if (requestedMarket !== 'ALL' && !assertCrmCountryAllowed(security, requestedMarket)) {
      return NextResponse.json({ error: 'Forbidden market' }, { status: 403 })
    }

    const countryFilter =
      requestedMarket === 'ALL'
        ? getCrmCountryFilter(security)
        : { countryCode: { in: [requestedMarket] } }

    const results: Record<string, unknown[]> = {}
    let total = 0
    const cap = type === 'all' ? 5 : pageSize

    const allowed = (permission: string) =>
      evaluateEffectivePermission({
        role: security.role,
        permission,
        overrides: security.permissionOverrides,
      }).allowed

    const canCustomers = allowed('users:view') || allowed('customers:view')
    const canTaskers = allowed('taskers:view')
    const canUsers = canCustomers || canTaskers
    const canCompanies = allowed('companies:view')
    const canJobs = allowed('jobs:view')
    const canDisputes = allowed('disputes:view')
    const canPayments = allowed('finance:payments:view')
    const canListings = allowed('realestate:view')

    const permissionForType: Record<string, boolean> = {
      users: canUsers,
      companies: canCompanies,
      jobs: canJobs,
      disputes: canDisputes,
      payments: canPayments,
      listings: canListings,
    }
    if (type !== 'all' && !permissionForType[type]) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if ((type === 'all' || type === 'users') && canUsers) {
      const visibleUserRoles =
        canCustomers && canTaskers
          ? ['CUSTOMER', 'TASKER']
          : canCustomers
            ? ['CUSTOMER']
            : ['TASKER']

      const where: any = {
        ...countryFilter,
        role: { in: visibleUserRoles },
        OR: [
          { id: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { mxId: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
        ],
      }
      const [rows, count] = await Promise.all([
        prisma.user.findMany({
          where,
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
          take: cap,
        }),
        type === 'users' ? prisma.user.count({ where }) : Promise.resolve(0),
      ])
      results.users = rows
      if (type === 'users') total = count
    }

    if ((type === 'all' || type === 'companies') && canCompanies) {
      const where: any = {
        ...countryFilter,
        OR: [
          { id: { contains: query, mode: 'insensitive' } },
          { companyName: { contains: query, mode: 'insensitive' } },
          { registrationNo: { contains: query, mode: 'insensitive' } },
          { mxId: { contains: query, mode: 'insensitive' } },
        ],
      }
      const [rows, count] = await Promise.all([
        prisma.companyProfile.findMany({
          where,
          select: {
            id: true,
            companyName: true,
            mxId: true,
            verificationStatus: true,
            countryCode: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: type === 'companies' ? skip : 0,
          take: cap,
        }),
        type === 'companies' ? prisma.companyProfile.count({ where }) : Promise.resolve(0),
      ])
      results.companies = rows
      if (type === 'companies') total = count
    }

    if ((type === 'all' || type === 'jobs') && canJobs) {
      const where: any = {
        ...countryFilter,
        OR: [
          { id: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
        ],
      }
      const [rows, count] = await Promise.all([
        prisma.marketplaceJob.findMany({
          where,
          select: { id: true, title: true, status: true, createdAt: true, countryCode: true },
          orderBy: { createdAt: 'desc' },
          skip: type === 'jobs' ? skip : 0,
          take: cap,
        }),
        type === 'jobs' ? prisma.marketplaceJob.count({ where }) : Promise.resolve(0),
      ])
      results.jobs = rows
      if (type === 'jobs') total = count
    }

    if ((type === 'all' || type === 'disputes') && canDisputes) {
      const where: any = {
        ...countryFilter,
        OR: [
          { id: { contains: query, mode: 'insensitive' } },
          { jobId: { contains: query, mode: 'insensitive' } },
          { reason: { contains: query, mode: 'insensitive' } },
          { status: { contains: query, mode: 'insensitive' } },
        ],
      }
      const [rows, count] = await Promise.all([
        prisma.marketplaceDispute.findMany({
          where,
          select: { id: true, jobId: true, reason: true, status: true, countryCode: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          skip: type === 'disputes' ? skip : 0,
          take: cap,
        }),
        type === 'disputes' ? prisma.marketplaceDispute.count({ where }) : Promise.resolve(0),
      ])
      results.disputes = rows
      if (type === 'disputes') total = count
    }

    if ((type === 'all' || type === 'listings') && canListings) {
      const where: any = {
        ...countryFilter,
        OR: [
          { id: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
          { district: { contains: query, mode: 'insensitive' } },
          { city: { contains: query, mode: 'insensitive' } },
        ],
      }
      const [rows, count] = await Promise.all([
        prisma.realEstateListing.findMany({
          where,
          select: {
            id: true,
            title: true,
            status: true,
            propertyType: true,
            purpose: true,
            priceLkr: true,
            countryCode: true,
            district: true,
            city: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: type === 'listings' ? skip : 0,
          take: cap,
        }),
        type === 'listings' ? prisma.realEstateListing.count({ where }) : Promise.resolve(0),
      ])
      results.listings = rows
      if (type === 'listings') total = count
    }

    if ((type === 'all' || type === 'payments') && canPayments) {
      const candidateLimit = type === 'payments' ? Math.min(200, pageSize * 6) : 30
      const candidates = await prisma.paymentIntent.findMany({
        where: {
          OR: [
            { id: { contains: query, mode: 'insensitive' } },
            { jobId: { contains: query, mode: 'insensitive' } },
            { merchantOrderId: { contains: query, mode: 'insensitive' } },
            { paymentId: { contains: query, mode: 'insensitive' } },
            { status: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          jobId: true,
          merchantOrderId: true,
          paymentId: true,
          gateway: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: candidateLimit,
      })

      const jobIds = [...new Set(candidates.map(item => item.jobId))]
      const visibleJobs = jobIds.length
        ? await prisma.marketplaceJob.findMany({
            where: { id: { in: jobIds }, ...countryFilter },
            select: { id: true, countryCode: true, title: true },
          })
        : []
      const visibleJobMap = new Map(visibleJobs.map(job => [job.id, job]))
      const visible = candidates
        .filter(item => visibleJobMap.has(item.jobId))
        .map(item => ({
          ...item,
          amount: item.amount.toString(),
          countryCode: visibleJobMap.get(item.jobId)?.countryCode || null,
          jobTitle: visibleJobMap.get(item.jobId)?.title || null,
        }))

      results.payments = type === 'payments'
        ? visible.slice(skip, skip + pageSize)
        : visible.slice(0, cap)
      if (type === 'payments') total = visible.length
    }

    if (type === 'all') {
      total = Object.values(results).reduce((sum, rows) => sum + rows.length, 0)
    }

    return NextResponse.json(
      {
        results,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        market: requestedMarket,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    secureConsole.error('CRM search GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
