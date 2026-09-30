import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'
import { safeParseJsonArr } from '@/lib/db-utils'

export async function GET(_request: NextRequest) {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    })

    return NextResponse.json(
      plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        price: plan.price,
        description: plan.description,
        features: safeParseJsonArr(plan.features),
      }))
    )
  } catch (error) {
    console.error('Subscription plans list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'settings:edit',
      allowedRoles: ['SUPER_ADMIN'],
      level: 'sensitive',
    })
    if (!guard.ok) return guard.response

    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
    const price = typeof body.price === 'number' ? body.price : Number(body.price)
    const description =
      typeof body.description === 'string'
        ? body.description.trim().slice(0, 2000)
        : null
    const features = Array.isArray(body.features)
      ? body.features
          .filter((item: unknown): item is string => typeof item === 'string')
          .map(item => item.trim().slice(0, 240))
          .filter(Boolean)
          .slice(0, 50)
      : []

    if (!name || !Number.isFinite(price) || price < 0 || price > 100000000) {
      return NextResponse.json({ error: 'Valid name and non-negative price are required' }, { status: 400 })
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        price,
        description,
        features: JSON.stringify(features),
      },
    })

    return NextResponse.json({
      success: true,
      plan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        description: plan.description,
        features: safeParseJsonArr(plan.features),
      },
    })
  } catch (error) {
    console.error('Subscription plan create error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
