import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getCrmCountryFilter,
  guardCrmRequest,
} from '@/lib/crm/security'
import { evaluateEffectivePermission } from '@/lib/crm/governance'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'trust:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const allowed = (permission: string) =>
      evaluateEffectivePermission({
        role: security.role,
        permission,
        overrides: security.permissionOverrides,
      }).allowed

    const canKyc = allowed('kyc:view')
    const canDisputes = allowed('disputes:view')
    const canRisk = allowed('risk_events:read')
    const canCheating = allowed('cheating:view')
    const canSecurity = allowed('security:view')

    if (!canKyc && !canDisputes && !canRisk && !canCheating && !canSecurity) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const countryFilter = getCrmCountryFilter(security)
    const jobCountryFilter = security.isSuperAdmin
      ? {}
      : { job: { countryCode: { in: security.assignedCountries } } }
    const loginCountryFilter = security.isSuperAdmin
      ? {}
      : { user: { countryCode: { in: security.assignedCountries } } }

    const [
      pendingKyc,
      rejectedKyc,
      openDisputes,
      pendingCheating,
      pendingRisk,
      highRisk,
      suspiciousLogins,
      recentRisk,
      recentDisputes,
      recentCheating,
      recentKyc,
    ] = await Promise.all([
      canKyc
        ? prisma.identityDocument.count({ where: { status: 'PENDING', ...countryFilter } })
        : Promise.resolve(0),
      canKyc
        ? prisma.identityDocument.count({ where: { status: 'REJECTED', ...countryFilter } })
        : Promise.resolve(0),
      canDisputes
        ? prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] }, ...countryFilter } })
        : Promise.resolve(0),
      canCheating
        ? prisma.offPlatformDeal.count({ where: { status: 'PENDING', ...countryFilter } })
        : Promise.resolve(0),
      canRisk
        ? prisma.marketplaceRiskEvent.count({
            where: { reviewedAt: null, ...jobCountryFilter },
          })
        : Promise.resolve(0),
      canRisk
        ? prisma.marketplaceRiskEvent.count({
            where: {
              reviewedAt: null,
              severity: { in: ['HIGH', 'CRITICAL'] },
              ...jobCountryFilter,
            },
          })
        : Promise.resolve(0),
      canSecurity
        ? prisma.loginActivity.count({
            where: {
              isSuspicious: true,
              createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
              ...loginCountryFilter,
            },
          })
        : Promise.resolve(0),
      canRisk
        ? prisma.marketplaceRiskEvent.findMany({
            where: { ...jobCountryFilter },
            include: {
              job: { select: { id: true, title: true, status: true, countryCode: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 12,
          })
        : Promise.resolve([]),
      canDisputes
        ? prisma.dispute.findMany({
            where: { ...countryFilter },
            include: {
              job: { select: { id: true, title: true, status: true } },
              raisedBy: { select: { id: true, mxId: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 12,
          })
        : Promise.resolve([]),
      canCheating
        ? prisma.offPlatformDeal.findMany({
            where: { ...countryFilter },
            orderBy: { createdAt: 'desc' },
            take: 12,
          })
        : Promise.resolve([]),
      canKyc
        ? prisma.identityDocument.findMany({
            where: { ...countryFilter },
            select: {
              id: true,
              userId: true,
              docType: true,
              side: true,
              status: true,
              fullName: true,
              countryCode: true,
              createdAt: true,
              reviewedAt: true,
              user: { select: { id: true, mxId: true, name: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 12,
          })
        : Promise.resolve([]),
    ])

    return NextResponse.json(
      {
        permissions: {
          kyc: canKyc,
          disputes: canDisputes,
          risk: canRisk,
          cheating: canCheating,
          security: canSecurity,
        },
        metrics: {
          pendingKyc,
          rejectedKyc,
          openDisputes,
          pendingCheating,
          pendingRisk,
          highRisk,
          suspiciousLogins,
        },
        recent: {
          risk: recentRisk,
          disputes: recentDisputes,
          cheating: recentCheating,
          kyc: recentKyc,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM trust overview GET error:', error)
    return NextResponse.json({ error: 'Failed to load trust overview' }, { status: 500 })
  }
}
