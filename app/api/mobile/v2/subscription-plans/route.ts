import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { safeParseJsonArr } from '@/lib/db-utils'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
      select: {
        id: true,
        name: true,
        price: true,
        description: true,
        features: true,
      },
    })

    return NextResponse.json(
      plans.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description,
        features: safeParseJsonArr(p.features),
      }))
    )
  } catch (error) {
    console.error('Subscription plans list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
