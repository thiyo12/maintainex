import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.companyProfile.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        commissionRate: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
      },
    })
    if (!profile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
    }

    const activeSubscription = profile.subscriptions[0] ?? null

    return NextResponse.json({
      commissionRate: profile.commissionRate,
      subscriptionStatus: profile.subscriptionStatus,
      subscriptionExpiresAt: profile.subscriptionExpiresAt?.toISOString() ?? null,
      activeSubscription: activeSubscription
        ? {
            id: activeSubscription.id,
            planId: activeSubscription.planId,
            planName: activeSubscription.plan.name,
            planPrice: activeSubscription.plan.price,
            planFeatures: activeSubscription.plan.features,
            status: activeSubscription.status,
            startDate: activeSubscription.startDate.toISOString(),
            endDate: activeSubscription.endDate?.toISOString() ?? null,
            autoRenew: activeSubscription.autoRenew,
          }
        : null,
    })
  } catch (error) {
    console.error('Company subscription get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { planId, autoRenew } = await request.json()
    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 })
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: 'Invalid or inactive plan' }, { status: 400 })
    }

    if (Number(plan.price) > 0) {
      return NextResponse.json(
        {
          error: 'Paid company subscriptions require verified billing before activation.',
          code: 'SUBSCRIPTION_BILLING_REQUIRED',
        },
        { status: 503 }
      )
    }

    const profile = await prisma.companyProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!profile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
    }

    const startDate = new Date()
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 1)

    const [subscription] = await prisma.$transaction([
      prisma.companySubscription.create({
        data: {
          companyId: profile.id,
          planId,
          status: 'ACTIVE',
          startDate,
          endDate,
          autoRenew: autoRenew ?? true,
        },
      }),
      prisma.companyProfile.update({
        where: { id: profile.id },
        data: {
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiresAt: endDate,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        planId: subscription.planId,
        status: subscription.status,
        startDate: subscription.startDate.toISOString(),
        endDate: subscription.endDate?.toISOString(),
        autoRenew: subscription.autoRenew,
      },
    })
  } catch (error) {
    console.error('Company subscription create error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const profile = await prisma.companyProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!profile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
    }

    await prisma.companySubscription.updateMany({
      where: { companyId: profile.id, status: 'ACTIVE' },
      data: { status: 'CANCELLED', autoRenew: false },
    })

    await prisma.companyProfile.update({
      where: { id: profile.id },
      data: { subscriptionStatus: 'CANCELLED' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Company subscription cancel error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
