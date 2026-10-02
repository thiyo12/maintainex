import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCrmCountryCodes, getCrmCountryFilter, guardCrmRequest } from '@/lib/crm/security'
import { evaluateActionInitiation } from '@/lib/crm/governance'

const VALID_STATUSES = new Set([
  'ALL',
  'REQUESTED',
  'RESERVED',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'REVERSED',
  'CANCELLED',
])

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'finance:payouts:view',
      permissionClass: 'READ',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || 'ALL').trim().toUpperCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10) || 30))

    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid payout status' }, { status: 400 })
    }

    const countryFilter = getCrmCountryFilter(security)
    const where: any = { ...countryFilter }
    if (status !== 'ALL') where.status = status

    const now = new Date()
    const scopedCountryCodes = getCrmCountryCodes(security)
    const freezeMarkets = scopedCountryCodes === null
      ? undefined
      : ['GLOBAL', ...scopedCountryCodes]

    const [payouts, total, stats, activeFreezes] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payout.count({ where }),
      prisma.payout.groupBy({
        by: ['currency', 'status'],
        where: countryFilter,
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.crmEmergencyControl.findMany({
        where: {
          controlKey: 'PAYOUTS_FROZEN',
          active: true,
          ...(freezeMarkets ? { market: { in: freezeMarkets } } : {}),
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
        select: {
          id: true,
          market: true,
          activatedAt: true,
          expiresAt: true,
        },
        orderBy: { activatedAt: 'desc' },
      }),
    ])

    const userIds = [...new Set(payouts.map(payout => payout.userId))]
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            name: true,
            email: true,
            mxId: true,
            identityStatus: true,
            isSuspended: true,
            isBanned: true,
            taskerProfile: {
              select: {
                verificationStatus: true,
                isVerified: true,
              },
            },
            companyProfile: {
              select: {
                companyName: true,
                mxId: true,
                verificationStatus: true,
                isVerified: true,
              },
            },
          },
        })
      : []

    const userMap = new Map(users.map(user => [user.id, user]))

    return NextResponse.json(
      {
        payouts: payouts.map(payout => {
          const user = userMap.get(payout.userId)
          return {
            ...payout,
            amount: payout.amount.toString(),
            bankDetails: payout.bankDetails ? '[REDACTED]' : null,
            provider: user
              ? {
                  id: user.id,
                  name: user.companyProfile?.companyName || user.name,
                  mxId: user.companyProfile?.mxId || user.mxId,
                  email: user.email,
                  identityStatus: user.identityStatus,
                  verificationStatus:
                    user.companyProfile?.verificationStatus ||
                    user.taskerProfile?.verificationStatus ||
                    null,
                  isVerified:
                    user.companyProfile?.isVerified ??
                    user.taskerProfile?.isVerified ??
                    false,
                  isSuspended: user.isSuspended,
                  isBanned: user.isBanned,
                }
              : null,
          }
        }),
        stats: stats.map(row => ({
          currency: row.currency,
          status: row.status,
          count: row._count._all,
          amount: row._sum.amount?.toString() ?? '0',
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
        actions: {
          payout: evaluateActionInitiation({
            role: security.role,
            actionId: 'finance.payout',
            overrides: security.permissionOverrides,
          }).allowed,
        },
        emergency: {
          freezes: activeFreezes.map(freeze => ({
            id: freeze.id,
            market: freeze.market,
            activatedAt: freeze.activatedAt,
            expiresAt: freeze.expiresAt,
          })),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM payout list error:', error)
    return NextResponse.json({ error: 'Failed to load payout queue' }, { status: 500 })
  }
}
