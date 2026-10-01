import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCrmCountryFilter, guardCrmRequest } from '@/lib/crm/security'

function parseDate(value: string | null, endOfDay = false): Date | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCHours(23, 59, 59, 999)
  }
  return date
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'finance:settlements:view',
      permissionClass: 'READ',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const fromRaw = searchParams.get('from')
    const toRaw = searchParams.get('to')
    const providerType = (searchParams.get('providerType') || 'ALL').toUpperCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10) || 30))

    if (!['ALL', 'TASKER', 'COMPANY'].includes(providerType)) {
      return NextResponse.json({ error: 'Invalid providerType' }, { status: 400 })
    }

    const from = fromRaw ? parseDate(fromRaw) : null
    const to = toRaw ? parseDate(toRaw, true) : null

    if (fromRaw && !from) {
      return NextResponse.json({ error: 'Invalid from date' }, { status: 400 })
    }
    if (toRaw && !to) {
      return NextResponse.json({ error: 'Invalid to date' }, { status: 400 })
    }
    if (from && to && from > to) {
      return NextResponse.json({ error: 'from date must be before to date' }, { status: 400 })
    }

    const countryFilter = getCrmCountryFilter(security)
    const where: any = {
      ...countryFilter,
      status: 'PAID',
      commissionPaid: true,
    }

    if (providerType !== 'ALL') where.providerType = providerType

    if (from || to) {
      where.paidAt = {}
      if (from) where.paidAt.gte = from
      if (to) where.paidAt.lte = to
    }

    const [settlements, total, totalsByCurrency] = await Promise.all([
      prisma.weeklySettlement.findMany({
        where,
        orderBy: [{ paidAt: 'desc' }, { weekStart: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.weeklySettlement.count({ where }),
      prisma.weeklySettlement.groupBy({
        by: ['currency'],
        where,
        _sum: {
          totalEarnings: true,
          commissionOwed: true,
        },
        _count: { _all: true },
      }),
    ])

    const providerIds = [...new Set(settlements.map(item => item.providerId))]
    const companyProviderIds = [
      ...new Set(
        settlements
          .filter(item => item.providerType === 'COMPANY')
          .map(item => item.providerId)
      ),
    ]

    const [users, companies] = await Promise.all([
      providerIds.length
        ? prisma.user.findMany({
            where: { id: { in: providerIds } },
            select: {
              id: true,
              name: true,
              mxId: true,
              countryCode: true,
            },
          })
        : [],
      companyProviderIds.length
        ? prisma.companyProfile.findMany({
            where: { userId: { in: companyProviderIds } },
            select: {
              id: true,
              userId: true,
              companyName: true,
              mxId: true,
              countryCode: true,
            },
          })
        : [],
    ])

    const userMap = new Map(users.map(user => [user.id, user]))
    const companyByUser = new Map(companies.map(company => [company.userId, company]))

    return NextResponse.json(
      {
        settlements: settlements.map(item => {
          const user = userMap.get(item.providerId)
          const company = item.providerType === 'COMPANY'
            ? companyByUser.get(item.providerId)
            : null

          return {
            ...item,
            provider: company
              ? {
                  entityId: company.id,
                  userId: item.providerId,
                  name: company.companyName,
                  mxId: company.mxId,
                  countryCode: company.countryCode,
                }
              : user
                ? {
                    entityId: user.id,
                    userId: user.id,
                    name: user.name,
                    mxId: user.mxId,
                    countryCode: user.countryCode,
                  }
                : null,
          }
        }),
        summaryByCurrency: totalsByCurrency
          .map(row => {
            const gross = row._sum.totalEarnings || 0
            const commission = row._sum.commissionOwed || 0
            return {
              currency: row.currency,
              count: row._count._all,
              gross,
              commission,
              net: gross - commission,
            }
          })
          .sort((a, b) => a.currency.localeCompare(b.currency)),
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM settlement history GET error:', error)
    return NextResponse.json({ error: 'Failed to load settlement history' }, { status: 500 })
  }
}
