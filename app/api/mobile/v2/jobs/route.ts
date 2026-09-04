import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { blastJobToTaskers } from '@/lib/job-blast'
import { getPriceEstimate } from '@/lib/pricing-engine'
import { getSetting } from '@/lib/settings'
import { notifyTaskerAssigned } from '@/lib/notifications'
import { sendExpoPush } from '@/lib/push'

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
      smartBookingJson, latitude, longitude,
      serviceTemplateId, templateJobId, preferredTimeSlot, countryCode, targetTaskerId,
    } = body

    title = sanitize(title, 200)
    description = sanitize(description, 5000)
    categoryId = sanitize(categoryId, 50)
    if (areaId) areaId = sanitize(areaId, 50)
    if (postalCode) postalCode = sanitize(postalCode, 20)
    if (serviceTemplateId) serviceTemplateId = sanitize(serviceTemplateId, 50)
    if (templateJobId) templateJobId = sanitize(templateJobId, 50)
    if (targetTaskerId) targetTaskerId = sanitize(targetTaskerId, 50)
    const finalPreferredTimeSlot = ['morning', 'afternoon', 'evening', 'anytime'].includes(preferredTimeSlot) ? preferredTimeSlot : null
    const finalCountryCode = typeof countryCode === 'string' && /^[A-Za-z]{2,3}$/.test(countryCode) ? countryCode.toUpperCase() : 'LK'
    let finalSmartBookingJson: string | null = null
    if (typeof smartBookingJson === 'string' && smartBookingJson.trim().length > 0) {
      finalSmartBookingJson = sanitize(smartBookingJson, 20000)
    } else if (smartBookingJson && typeof smartBookingJson === 'object') {
      finalSmartBookingJson = JSON.stringify(smartBookingJson)
    }

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
        serviceTemplateId: serviceTemplateId || null,
        templateJobId: templateJobId || null,
        preferredTimeSlot: finalPreferredTimeSlot,
        countryCode: finalCountryCode,
        targetTaskerId: targetTaskerId || null,
        responseDeadline: new Date(Date.now() + (await getSetting('matching.response_hours', 2)) * 60 * 60 * 1000),
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
        smartBookingJson: finalSmartBookingJson,
        latitude: typeof latitude === 'number' && isFinite(latitude) ? latitude : null,
        longitude: typeof longitude === 'number' && isFinite(longitude) ? longitude : null,
      },
    })

    let notifiedCount = 0
    try {
      const blast = await blastJobToTaskers(job.id)
      notifiedCount = blast.matched
    } catch (err) {
      console.error('Blast job error:', err)
    }

    let conversationId: string | null = null
    if (job.targetTaskerId) {
      const tasker = await prisma.taskerProfile.findUnique({
        where: { id: job.targetTaskerId },
        include: { user: { select: { id: true, name: true, pushToken: true } } },
      })
      if (tasker) {
        const existingConversation = await prisma.conversation.findFirst({
          where: {
            AND: [
              { jobId: job.id },
              { participants: { some: { userId: user.id } } },
              { participants: { some: { userId: tasker.userId } } },
            ],
          },
          select: { id: true },
        })
        if (existingConversation) {
          conversationId = existingConversation.id
        } else {
          const conversation = await prisma.conversation.create({
            data: {
              jobId: job.id,
              participants: { create: [{ userId: user.id }, { userId: tasker.userId }] },
            },
          })
          conversationId = conversation.id
        }
        const taskerName = tasker.user.name || 'Your tasker'
        await notifyTaskerAssigned(job.id, user.id, job.targetTaskerId, taskerName, job.title)
        if (tasker.user.pushToken) {
          await sendExpoPush(
            tasker.user.pushToken,
            'New Booking Request',
            `You've been selected for "${job.title}". Review the details and submit a quote.`,
            { type: 'JOB_ASSIGNED', jobId: job.id }
          )
        }
      }
    }

    return NextResponse.json({
      job: { ...job, budgetAmount: Number(job.budgetAmount) },
      notifiedCount,
      conversationId,
      estimatedResponseTime: '5-30 minutes',
    }, { status: 201 })
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

      // Taskers only see jobs in the categories they selected under "Your Services".
      // Primary source of truth: TaskerSkill → TemplateJob.categoryId (JobCategory id).
      // Fallback for legacy profiles without a service selection: profile.skills slugs.
      let allowedCategoryIds: string[] = []
      const selections = await prisma.taskerSkill.findMany({
        where: { tasker: { userId: user.id } },
        select: { jobId: true },
      })

      if (selections.length > 0) {
        const templateJobs = await prisma.templateJob.findMany({
          where: { id: { in: selections.map(s => s.jobId) } },
          select: { categoryId: true },
        })
        allowedCategoryIds = [...new Set(templateJobs.map(j => j.categoryId))]
      } else {
        const profile = await prisma.taskerProfile.findUnique({
          where: { userId: user.id },
          select: { skills: true },
        })
        const slugs: string[] = []
        if (profile?.skills) {
          try {
            const parsed = JSON.parse(profile.skills)
            if (Array.isArray(parsed)) slugs.push(...parsed.map(String))
          } catch {
            slugs.push(profile.skills)
          }
        }
        if (slugs.length > 0) {
          const categories = await prisma.category.findMany({
            where: { slug: { in: slugs } },
            select: { id: true },
          })
          allowedCategoryIds = [...new Set([...categories.map(c => c.id), ...slugs])]
        }
      }

      where.categoryId = { in: allowedCategoryIds }
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
      smartBooking: j.smartBookingJson ? JSON.parse(j.smartBookingJson) : null,
    })) })
  } catch (error) {
    console.error('List jobs error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
