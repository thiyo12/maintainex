import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'

const clean = (s: string, maxLen = 2000) => s.replace(/<[^>]*>/g, '').trim().slice(0, maxLen)

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json().catch(() => null) || {}
    const title = clean(body.title || '', 160)
    const description = clean(body.description || '', 2000)
    const categoryId = body.categoryId ? String(body.categoryId) : null
    const cityName = body.cityName ? clean(String(body.cityName), 120) : null
    const budgetMin = body.budgetMin ? Number(body.budgetMin) : null
    const budgetMax = body.budgetMax ? Number(body.budgetMax) : null

    if (!title) {
      return NextResponse.json({ error: 'Job title is required' }, { status: 400 })
    }

    const req = await prisma.customJobRequest.create({
      data: {
        userId: user.id,
        title,
        description,
        categoryId,
        cityName,
        budgetMin,
        budgetMax,
      },
    })

    return NextResponse.json({ request: req }, { status: 201 })
  } catch (error) {
    secureConsole.error('Custom job request error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requests = await prisma.customJobRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ requests })
  } catch (error) {
    secureConsole.error('List custom jobs error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
