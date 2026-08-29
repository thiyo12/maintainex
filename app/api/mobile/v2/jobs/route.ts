import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { matchJobToTaskers } from '@/lib/job-matcher'
import { getPriceEstimate } from '@/lib/pricing-engine'

const sanitize = (s: string, maxLen = 2000) => s.replace(/<[^>]*>/g, '').trim().slice(0, maxLen)

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    let {
      title, description, categoryId, photos,
      budgetType, budgetAmount, areaId, postalCode, preferredDate,
      materialHandling, urgency, estimatedDuration, workersCount,
    } = body

    title = sanitize(title, 200)
    description = sanitize(description, 5000)
    categoryId = sanitize(categoryId, 50)
    if (areaId) areaId = sanitize(areaId, 50)
    if (postalCode) postalCode = sanitize(postalCode, 20)

    if (!title || !description || !categoryId || !budgetType || budgetAmount == null) {
      return NextResponse.json({ error: 'Missing required fields: title, description, categoryId, budgetType, budgetAmount' }, { status: 400 })
    }

    const validBudgetTypes = ['FIXED', 'HOURLY', 'NEGOTIABLE', 'REQUEST_QUOTES']
    if (!validBudgetTypes.includes(budgetType)) {
      return NextResponse.json({ error: 'Invalid budgetType. Must be FIXED, HOURLY, NEGOTIABLE, or REQUEST_QUOTES' }, { status: 400 })
    }

    let aiEstimateJson: string | null = null
    const validMaterialHandling = ['tasker_brings', 'customer_provides', 'quote_both']
    const finalMaterialHandling = validMaterialHandling.includes(materialHandling) ? materialHandling : 'tasker_brings'

    try {
      const estimate = await getPriceEstimate({
        categoryId,
        categoryName: title,
        description,
        title,
        areaId: areaId || undefined,
        countryCode: 'LK',
        urgency: urgency || 'normal',
        estimatedDuration: estimatedDuration ? Number(estimatedDuration) : undefined,
        workersCount: workersCount ? Number(workersCount) : undefined,
        materialHandling: finalMaterialHandling,
      })
      aiEstimateJson = JSON.stringify(estimate)
    } catch (e) {
      console.error('AI estimate generation failed:', e)
    }

    const job = await prisma.marketplaceJob.create({
      data: {
        customerId: user.id,
        title,
        description,
        categoryId,
        photos: JSON.stringify(photos || []),
        budgetType,
        budgetAmount,
        areaId: areaId || null,
        postalCode: postalCode || null,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        urgency: urgency || 'normal',
        estimatedDuration: estimatedDuration ? Number(estimatedDuration) : null,
        workersCount: workersCount ? Number(workersCount) : 1,
        status: 'OPEN',
        aiEstimateJson,
        materialHandling: finalMaterialHandling,
      },
    })

    matchJobToTaskers(job.id).catch(err => console.error('Match job error:', err))

    return NextResponse.json({ job: { ...job, budgetAmount: Number(job.budgetAmount) } }, { status: 201 })
  } catch (error) {
    console.error('Create job error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const role = searchParams.get('role')
    const myQuotes = searchParams.get('myQuotes')
    const areaId = searchParams.get('areaId')

    let where: any = { isActive: true }

    if (myQuotes === 'true') {
      const quoteJobIds = await prisma.jobQuote.findMany({
        where: { providerId: user.id },
        select: { jobId: true },
        distinct: ['jobId'],
      })
      where.id = { in: quoteJobIds.map(q => q.jobId) }
    } else if (role === 'provider') {
      where.status = 'OPEN'
      if (areaId) where.areaId = areaId
    } else {
      where.customerId = user.id
    }

    if (status) where.status = status

    const jobs = await prisma.marketplaceJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ jobs: jobs.map((j) => ({
      ...j,
      budgetAmount: Number(j.budgetAmount),
      aiEstimate: j.aiEstimateJson ? JSON.parse(j.aiEstimateJson) : null,
    })) })
  } catch (error) {
    console.error('List jobs error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
