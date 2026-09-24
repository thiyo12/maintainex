import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { blastJobToTaskers } from '@/lib/job-blast'
import { calculatePrice } from '@/lib/pricing/engine'
import { getSetting } from '@/lib/settings'
import { notifyTaskerAssigned } from '@/lib/notifications'
import { sendExpoPush } from '@/lib/push'
import { checkRateLimit, userKey } from '@/lib/rate-limit/middleware'

const sanitize = (s: string, maxLen = 2000) => s.replace(/<[^>]*>/g, '').trim().slice(0, maxLen)

function parseBigIntInput(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value > 0n ? value : null
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return BigInt(value)
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = BigInt(value.trim())
    return parsed > 0n ? parsed : null
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const rateLimit = await checkRateLimit(request, {
      policyName: 'JOB_CREATE',
      keyPrefix: 'job_create',
      identifier: user.id,
    })
    if (!rateLimit.allowed) return rateLimit.response!

    const body = await request.json()
    const idempotencyKey = request.headers.get('idempotency-key')?.trim() || null
    const requestFingerprint = idempotencyKey
      ? createHash('sha256').update(JSON.stringify(body)).digest('hex')
      : null

    if (idempotencyKey) {
      const existing = await prisma.idempotencyRecord.findUnique({ where: { idempotencyKey } })
      if (existing && existing.expiresAt >= new Date()) {
        if (
          existing.userId !== user.id ||
          existing.operation !== 'CREATE_MARKETPLACE_JOB' ||
          existing.requestFingerprint !== requestFingerprint
        ) {
          return NextResponse.json({ error: 'Idempotency key was already used for a different request' }, { status: 409 })
        }

        if (existing.status === 'COMPLETED' && existing.resultPayload) {
          const cached = JSON.parse(existing.resultPayload) as { jobId?: string }
          if (cached.jobId) {
            const replayJob = await prisma.marketplaceJob.findUnique({ where: { id: cached.jobId } })
            if (replayJob) {
              const replayConversation = await prisma.conversation.findFirst({
                where: {
                  jobId: replayJob.id,
                  participants: { some: { userId: user.id } },
                },
                select: { id: true },
              })
              return NextResponse.json({
                job: { ...replayJob, budgetAmount: replayJob.budgetAmount?.toString() ?? null },
                notifiedCount: replayJob.notifiedCount,
                conversationId: replayConversation?.id ?? null,
                estimatedResponseTime: '5-30 minutes',
                replayed: true,
              })
            }
          }
        }

        return NextResponse.json({ error: 'An identical job creation request is already being processed' }, { status: 409 })
      }
    }

    let {
      title, description, categoryId, photos,
      budgetType, budgetAmount, areaId, postalCode, preferredDate,
      materialHandling, urgency, estimatedDuration, workersCount,
      smartBookingJson, latitude, longitude,
      serviceTemplateId, templateJobId, preferredTimeSlot, countryCode, targetTaskerId,
    } = body

    title = typeof title === 'string' ? sanitize(title, 200) : ''
    description = typeof description === 'string' ? sanitize(description, 5000) : ''
    categoryId = typeof categoryId === 'string' ? sanitize(categoryId, 80) : ''
    if (typeof areaId === 'string') areaId = sanitize(areaId, 80)
    if (typeof postalCode === 'string') postalCode = sanitize(postalCode, 20)
    if (typeof serviceTemplateId === 'string') serviceTemplateId = sanitize(serviceTemplateId, 80)
    if (typeof templateJobId === 'string') templateJobId = sanitize(templateJobId, 80)
    if (typeof targetTaskerId === 'string') targetTaskerId = sanitize(targetTaskerId, 80)

    const budgetMinor = parseBigIntInput(budgetAmount)
    if (!title || !description || !categoryId || !budgetType) {
      return NextResponse.json({ error: 'Missing or invalid required fields: title, description, categoryId, budgetType' }, { status: 400 })
    }

    const validBudgetTypes = ['FIXED', 'HOURLY', 'NEGOTIABLE', 'REQUEST_QUOTES']
    if (!validBudgetTypes.includes(budgetType)) {
      return NextResponse.json({ error: 'Invalid budgetType. Must be FIXED, HOURLY, NEGOTIABLE, or REQUEST_QUOTES' }, { status: 400 })
    }

    const category = await prisma.jobCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, isActive: true },
    })
    if (!category?.isActive) return NextResponse.json({ error: 'Invalid or inactive categoryId' }, { status: 400 })

    let serviceTemplate: { id: string; jobCategoryId: string; templateJobId: string | null; isActive: boolean } | null = null
    if (serviceTemplateId) {
      serviceTemplate = await prisma.serviceTemplate.findUnique({
        where: { id: serviceTemplateId },
        select: { id: true, jobCategoryId: true, templateJobId: true, isActive: true },
      })
      if (!serviceTemplate?.isActive || serviceTemplate.jobCategoryId !== categoryId) {
        return NextResponse.json({ error: 'serviceTemplateId does not belong to categoryId' }, { status: 400 })
      }
    }

    if (templateJobId) {
      const templateJob = await prisma.templateJob.findUnique({
        where: { id: templateJobId },
        select: { id: true, categoryId: true, isActive: true },
      })
      if (!templateJob?.isActive || templateJob.categoryId !== categoryId) {
        return NextResponse.json({ error: 'templateJobId does not belong to categoryId' }, { status: 400 })
      }
      if (serviceTemplate?.templateJobId && serviceTemplate.templateJobId !== templateJob.id) {
        return NextResponse.json({ error: 'templateJobId conflicts with serviceTemplateId' }, { status: 400 })
      }
    } else if (serviceTemplate?.templateJobId) {
      templateJobId = serviceTemplate.templateJobId
    }

    if (serviceTemplate?.templateJobId) {
      const linked = await prisma.templateJob.findUnique({
        where: { id: serviceTemplate.templateJobId },
        select: { categoryId: true, isActive: true },
      })
      if (!linked?.isActive || linked.categoryId !== categoryId) {
        return NextResponse.json({ error: 'Service template has invalid TemplateJob relationship' }, { status: 400 })
      }
    }

    const finalPreferredTimeSlot = ['morning', 'afternoon', 'evening', 'anytime'].includes(preferredTimeSlot) ? preferredTimeSlot : null
    const finalCountryCode = typeof countryCode === 'string' && /^[A-Za-z]{2,3}$/.test(countryCode) ? countryCode.toUpperCase() : 'LK'

    if (finalCountryCode !== user.countryCode) {
      return NextResponse.json({
        error: 'Country mismatch: you cannot create jobs in a different country',
        code: 'COUNTRY_MISMATCH',
      }, { status: 403 })
    }

    const validMaterialHandling = ['tasker_brings', 'customer_provides', 'quote_both']
    const finalMaterialHandling = validMaterialHandling.includes(materialHandling) ? materialHandling : 'tasker_brings'

    let finalSmartBookingJson: string | null = null
    if (typeof smartBookingJson === 'string' && smartBookingJson.trim().length > 0) {
      finalSmartBookingJson = sanitize(smartBookingJson, 20000)
    } else if (smartBookingJson && typeof smartBookingJson === 'object') {
      finalSmartBookingJson = JSON.stringify(smartBookingJson)
    }

    let aiEstimateJson: string | null = null
    try {
      const estimate = await calculatePrice(prisma, {
        jobId: `pending-${Date.now()}-${user.id}`,
        categoryId,
        serviceTemplateId: serviceTemplateId || undefined,
        mode: budgetType === 'REQUEST_QUOTES' ? 'QUOTE' : 'BOOK_NOW',
        urgency: (urgency?.toUpperCase() || 'NORMAL') as 'NORMAL' | 'URGENT' | 'EMERGENCY',
        quantity: workersCount ? Number(workersCount) : undefined,
        durationMinutes: estimatedDuration ? Math.round(Number(estimatedDuration) * 60) : undefined,
        countryCode: finalCountryCode,
      })
      aiEstimateJson = JSON.stringify({
        baseAmount: estimate.baseAmount.toString(),
        urgencyAmount: estimate.urgencyAmount.toString(),
        serviceModifiers: estimate.serviceModifiers.toString(),
        providerGross: estimate.providerGross.toString(),
        platformFeeBps: estimate.platformFeeBps,
        platformFeeAmount: estimate.platformFeeAmount.toString(),
        customerTotal: estimate.customerTotal.toString(),
        currency: estimate.currency,
        pricingVersion: estimate.pricingVersion,
        ruleIds: estimate.ruleIds,
      })
    } catch (error) {
      console.error('Canonical price estimate generation failed:', error)
    }

    const jobData = {
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
      photos: JSON.stringify(Array.isArray(photos) ? photos : []),
      budgetType,
      budgetAmount: budgetMinor,
      areaId: areaId || null,
      postalCode: postalCode || null,
      preferredDate: preferredDate ? new Date(preferredDate) : null,
      urgency: typeof urgency === 'string' ? urgency.toLowerCase() : 'normal',
      estimatedDuration: estimatedDuration ? Number(estimatedDuration) : null,
      workersCount: workersCount ? Math.max(1, Number(workersCount)) : 1,
      status: 'OPEN',
      aiEstimateJson,
      materialHandling: finalMaterialHandling,
      smartBookingJson: finalSmartBookingJson,
      latitude: typeof latitude === 'number' && Number.isFinite(latitude) ? latitude : null,
      longitude: typeof longitude === 'number' && Number.isFinite(longitude) ? longitude : null,
    }

    let job
    try {
      if (idempotencyKey) {
        job = await prisma.$transaction(async tx => {
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
          await tx.idempotencyRecord.create({
            data: {
              idempotencyKey,
              userId: user.id,
              operation: 'CREATE_MARKETPLACE_JOB',
              status: 'PENDING',
              requestFingerprint,
              expiresAt,
            },
          })

          const created = await tx.marketplaceJob.create({ data: jobData })
          await tx.idempotencyRecord.update({
            where: { idempotencyKey },
            data: {
              status: 'COMPLETED',
              resultPayload: JSON.stringify({ jobId: created.id }),
            },
          })
          return created
        })
      } else {
        job = await prisma.marketplaceJob.create({ data: jobData })
      }
    } catch (error) {
      if (
        idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await prisma.idempotencyRecord.findUnique({ where: { idempotencyKey } })
        if (
          existing?.userId !== user.id ||
          existing?.operation !== 'CREATE_MARKETPLACE_JOB' ||
          existing?.requestFingerprint !== requestFingerprint
        ) {
          return NextResponse.json({ error: 'Idempotency key conflict' }, { status: 409 })
        }

        if (existing.status === 'COMPLETED' && existing.resultPayload) {
          const cached = JSON.parse(existing.resultPayload) as { jobId?: string }
          const replayJob = cached.jobId
            ? await prisma.marketplaceJob.findUnique({ where: { id: cached.jobId } })
            : null
          if (replayJob) {
            return NextResponse.json({
              job: { ...replayJob, budgetAmount: replayJob.budgetAmount?.toString() ?? null },
              notifiedCount: replayJob.notifiedCount,
              conversationId: null,
              estimatedResponseTime: '5-30 minutes',
              replayed: true,
            })
          }
        }

        return NextResponse.json({ error: 'An identical job creation request is already being processed' }, { status: 409 })
      }
      throw error
    }

    let notifiedCount = 0
    try {
      const blast = await blastJobToTaskers(job.id)
      notifiedCount = blast.matched
    } catch (error) {
      console.error('Blast job error:', error)
    }

    let conversationId: string | null = null
    if (job.targetTaskerId) {
      const tasker = await prisma.taskerProfile.findFirst({
        where: { OR: [{ id: job.targetTaskerId }, { userId: job.targetTaskerId }] },
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
        await notifyTaskerAssigned(job.id, user.id, tasker.id, taskerName, job.title)
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
      job: { ...job, budgetAmount: job.budgetAmount?.toString() ?? null },
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
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const role = searchParams.get('role')
    const myQuotes = searchParams.get('myQuotes')
    const areaId = searchParams.get('areaId')

    const where: any = { isActive: true }

    if (myQuotes === 'true') {
      let providerId = user.id
      let providerType: 'INDIVIDUAL' | 'COMPANY' = 'INDIVIDUAL'

      if (user.role === 'COMPANY') {
        const companyProfile = await prisma.companyProfile.findUnique({
          where: { userId: user.id },
          select: { id: true },
        })
        if (!companyProfile) {
          where.id = { in: [] }
        } else {
          providerId = companyProfile.id
          providerType = 'COMPANY'
        }
      }

      if (!where.id) {
        const quoteJobIds = await prisma.jobQuote.findMany({
          where: { providerId, providerType },
          select: { jobId: true },
          distinct: ['jobId'],
        })
        where.id = { in: quoteJobIds.map((quote) => quote.jobId) }
      }
    } else if (role === 'provider') {
      where.status = 'OPEN'
      where.countryCode = user.countryCode
      if (areaId) where.areaId = areaId

      let allowedCategoryIds: string[] = []

      if (user.role === 'COMPANY') {
        const companyProfile = await prisma.companyProfile.findUnique({
          where: { userId: user.id },
          select: {
            services: true,
            specialties: { select: { categoryId: true, jobId: true } },
          },
        })

        if (companyProfile) {
          const directCategoryIds = companyProfile.specialties
            .map((specialty) => specialty.categoryId)
            .filter((id): id is string => Boolean(id))

          const specialtyJobIds = companyProfile.specialties
            .map((specialty) => specialty.jobId)
            .filter((id): id is string => Boolean(id))

          const specialtyJobs = specialtyJobIds.length > 0
            ? await prisma.templateJob.findMany({
                where: { id: { in: specialtyJobIds }, isActive: true },
                select: { categoryId: true },
              })
            : []

          const serviceKeys: string[] = []
          if (companyProfile.services) {
            try {
              const parsed = JSON.parse(companyProfile.services)
              if (Array.isArray(parsed)) serviceKeys.push(...parsed.map(String))
            } catch {
              serviceKeys.push(...companyProfile.services.split(',').map((value) => value.trim()).filter(Boolean))
            }
          }

          const serviceCategories = serviceKeys.length > 0
            ? await prisma.jobCategory.findMany({
                where: {
                  isActive: true,
                  OR: [
                    { id: { in: serviceKeys } },
                    { slug: { in: serviceKeys } },
                    { name: { in: serviceKeys } },
                  ],
                },
                select: { id: true },
              })
            : []

          allowedCategoryIds = [...new Set([
            ...directCategoryIds,
            ...specialtyJobs.map((job) => job.categoryId),
            ...serviceCategories.map((category) => category.id),
          ])]
        }
      } else {
        const selections = await prisma.taskerSkill.findMany({
          where: { tasker: { userId: user.id } },
          select: { job: { select: { categoryId: true } } },
        })

        if (selections.length > 0) {
          allowedCategoryIds = [...new Set(selections.map((selection) => selection.job.categoryId))]
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
            const categories = await prisma.jobCategory.findMany({
              where: {
                isActive: true,
                OR: [
                  { id: { in: slugs } },
                  { slug: { in: slugs } },
                  { name: { in: slugs } },
                ],
              },
              select: { id: true },
            })
            allowedCategoryIds = categories.map((category) => category.id)
          }
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

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        ...job,
        budgetAmount: job.budgetAmount?.toString() ?? null,
        aiEstimate: job.aiEstimateJson ? JSON.parse(job.aiEstimateJson) : null,
        smartBooking: job.smartBookingJson ? JSON.parse(job.smartBookingJson) : null,
      })),
    })
  } catch (error) {
    console.error('List jobs error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
