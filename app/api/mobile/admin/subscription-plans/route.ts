import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    })

    return NextResponse.json(
      plans.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description,
        features: p.features,
      }))
    )
  } catch (error) {
    console.error('Subscription plans list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, price, description, features } = await request.json()
    if (!name || price === undefined) {
      return NextResponse.json({ error: 'Name and price are required' }, { status: 400 })
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        price,
        description,
        features: features || [],
      },
    })

    return NextResponse.json({
      success: true,
      plan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        description: plan.description,
        features: plan.features,
      },
    })
  } catch (error) {
    console.error('Subscription plan create error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
