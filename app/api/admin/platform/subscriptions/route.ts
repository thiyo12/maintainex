import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, getCrmCountryCodes, guardCrmRequest } from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'
import { getCurrencyForCountry } from '@/lib/shared/money/money'
import { safeParseJsonArr } from '@/lib/db-utils'

function planDto(plan: {
  id: string
  name: string
  price: number
  currency: string
  countryCode: string
  description: string | null
  features: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: plan.id,
    name: plan.name,
    price: plan.price,
    currency: plan.currency,
    countryCode: plan.countryCode,
    description: plan.description,
    features: safeParseJsonArr(plan.features),
    isActive: plan.isActive,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  }
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'subscriptions:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const scopedCountryCodes = getCrmCountryCodes(security)
    const planWhere = scopedCountryCodes === null
      ? {}
      : { countryCode: { in: scopedCountryCodes } }

    const companyWhere = scopedCountryCodes === null
      ? {}
      : { countryCode: { in: scopedCountryCodes } }

    const subscriptionWhere = scopedCountryCodes === null
      ? {}
      : { company: { countryCode: { in: scopedCountryCodes } } }

    const [
      plans,
      recentSubscriptions,
      activeSubscriptions,
      cancelledSubscriptions,
      trialCompanies,
      activeCompanies,
      pastDueCompanies,
    ] = await Promise.all([
      prisma.subscriptionPlan.findMany({
        where: planWhere,
        orderBy: [{ countryCode: 'asc' }, { price: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.companySubscription.findMany({
        where: subscriptionWhere,
        include: {
          company: {
            select: {
              id: true,
              companyName: true,
              mxId: true,
              countryCode: true,
              subscriptionStatus: true,
            },
          },
          plan: {
            select: {
              name: true,
              countryCode: true,
              currency: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.companySubscription.count({
        where: { ...subscriptionWhere, status: 'ACTIVE' },
      }),
      prisma.companySubscription.count({
        where: { ...subscriptionWhere, status: 'CANCELLED' },
      }),
      prisma.companyProfile.count({
        where: { ...companyWhere, subscriptionStatus: 'TRIAL' },
      }),
      prisma.companyProfile.count({
        where: { ...companyWhere, subscriptionStatus: 'ACTIVE' },
      }),
      prisma.companyProfile.count({
        where: { ...companyWhere, subscriptionStatus: 'PAST_DUE' },
      }),
    ])

    return NextResponse.json(
      {
        plans: plans.map(planDto),
        subscriptions: recentSubscriptions.map(item => ({
          id: item.id,
          companyId: item.companyId,
          companyName: item.company.companyName,
          companyMxId: item.company.mxId,
          countryCode: item.company.countryCode,
          planId: item.planId,
          planName: item.planNameSnapshot || item.plan.name,
          price: item.priceSnapshot ?? 0,
          currency: item.currency || item.plan.currency,
          status: item.status,
          autoRenew: item.autoRenew,
          startDate: item.startDate,
          endDate: item.endDate,
          createdAt: item.createdAt,
        })),
        metrics: {
          plans: plans.length,
          activePlans: plans.filter(plan => plan.isActive).length,
          activeSubscriptions,
          cancelledSubscriptions,
          trialCompanies,
          activeCompanies,
          pastDueCompanies,
        },
        canManage: security.isSuperAdmin,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    secureConsole.error('CRM subscriptions GET error:', error)
    return NextResponse.json({ error: 'Failed to load subscription controls' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'subscriptions:manage',
      allowedRoles: ['SUPER_ADMIN'],
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : ''
    const countryCode =
      typeof body?.countryCode === 'string' ? body.countryCode.trim().toUpperCase() : ''
    const price = typeof body?.price === 'number' ? body.price : Number(body?.price)
    const description =
      typeof body?.description === 'string' ? body.description.trim().slice(0, 2000) : null
    const features = Array.isArray(body?.features)
      ? body.features
          .filter((item: unknown): item is string => typeof item === 'string')
          .map((item: string) => item.trim().slice(0, 240))
          .filter(Boolean)
          .slice(0, 50)
      : []

    if (
      name.length < 2 ||
      !/^[A-Z]{2}$/.test(countryCode) ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 100000000
    ) {
      return NextResponse.json({ error: 'Invalid subscription plan payload' }, { status: 400 })
    }

    if (!assertCrmCountryAllowed(security, countryCode)) {
      return NextResponse.json({ error: 'Forbidden market' }, { status: 403 })
    }

    const currency = getCurrencyForCountry(countryCode)

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        price,
        currency,
        countryCode,
        description,
        features: JSON.stringify(features),
        isActive: body?.isActive !== false,
      },
    })

    await createAuditLog({
      action: 'CREATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'SubscriptionPlan',
      entityId: plan.id,
      entityName: plan.name,
      description: 'CRM subscription plan created',
      newValue: {
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        countryCode: plan.countryCode,
        isActive: plan.isActive,
      },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'HIGH',
    })

    return NextResponse.json({ plan: planDto(plan) }, { status: 201 })
  } catch (error) {
    secureConsole.error('CRM subscriptions POST error:', error)
    return NextResponse.json({ error: 'Failed to create subscription plan' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'subscriptions:manage',
      allowedRoles: ['SUPER_ADMIN'],
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const id = typeof body?.id === 'string' ? body.id : ''
    const isActive = body?.isActive

    if (!id || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'Only plan activation/deactivation is supported. Create a new plan for price changes.' },
        { status: 400 }
      )
    }

    const current = await prisma.subscriptionPlan.findUnique({ where: { id } })
    if (!current) {
      return NextResponse.json({ error: 'Subscription plan not found' }, { status: 404 })
    }

    if (!assertCrmCountryAllowed(security, current.countryCode)) {
      return NextResponse.json({ error: 'Forbidden market' }, { status: 403 })
    }

    const updated = await prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive },
    })

    await createAuditLog({
      action: 'UPDATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'SubscriptionPlan',
      entityId: id,
      entityName: current.name,
      description: `CRM subscription plan ${isActive ? 'activated' : 'deactivated'}`,
      oldValue: { isActive: current.isActive },
      newValue: { isActive },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ plan: planDto(updated) })
  } catch (error) {
    secureConsole.error('CRM subscriptions PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update subscription plan' }, { status: 500 })
  }
}
