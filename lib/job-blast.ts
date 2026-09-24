import { prisma } from './prisma'
import { createNotification, deliverNotification } from './notifications'
import { findCandidates } from './matching'

/**
 * Notify providers returned by the canonical matcher.
 * Immediate jobs are only delivered to providers who pass conflict/availability gates.
 */
export async function blastJobToTaskers(jobId: string): Promise<{ matched: number; totalCandidates: number }> {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job || job.status !== 'OPEN') return { matched: 0, totalCandidates: 0 }

  const result = await findCandidates(prisma, {
    jobId: job.id,
    userId: job.customerId,
    jobMode: job.budgetType === 'REQUEST_QUOTES' ? 'QUOTE' : 'BOOK_NOW',
    urgency: (job.urgency?.toUpperCase() || 'NORMAL') as 'NORMAL' | 'URGENT' | 'EMERGENCY',
    categoryId: job.categoryId,
    serviceTemplateId: job.serviceTemplateId || undefined,
    latitude: job.latitude,
    longitude: job.longitude,
    countryCode: job.countryCode || 'GLOBAL',
  })

  let individualCandidates = result.candidates.filter(candidate => candidate.providerType === 'INDIVIDUAL')
  let companyCandidates = result.candidates.filter(candidate => candidate.providerType === 'COMPANY')

  if (job.targetTaskerId) {
    const target = await prisma.taskerProfile.findFirst({
      where: {
        OR: [
          { id: job.targetTaskerId },
          { userId: job.targetTaskerId },
        ],
      },
      select: { userId: true },
    })
    individualCandidates = target
      ? individualCandidates.filter(candidate => candidate.userId === target.userId)
      : []
    companyCandidates = []
  }

  const individualUserIds = individualCandidates.map(candidate => candidate.userId || candidate.providerId)
  const profiles = await prisma.taskerProfile.findMany({
    where: { userId: { in: individualUserIds } },
    select: {
      id: true,
      userId: true,
      isOnline: true,
    },
  })
  const profileByUser = new Map(profiles.map(profile => [profile.userId, profile]))

  const companyIds = companyCandidates.map(candidate => candidate.companyId || candidate.providerId)
  const companies = await prisma.companyProfile.findMany({
    where: { id: { in: companyIds } },
    select: { id: true, userId: true },
  })
  const companyById = new Map(companies.map(company => [company.id, company]))

  await prisma.jobMatchQueue.deleteMany({ where: { jobId } })

  let matched = 0

  for (const candidate of individualCandidates) {
    const userId = candidate.userId || candidate.providerId
    const profile = profileByUser.get(userId)
    if (!profile) continue

    try {
      await prisma.jobMatchQueue.create({
        data: {
          jobId,
          taskerId: profile.id,
          score: candidate.score,
          rank: candidate.rank,
          status: 'notified',
          notifiedAt: new Date(),
          wave: 1,
        },
      })
    } catch {
      continue
    }

    await deliverNotification({
      userId,
      title: profile.isOnline ? 'New job available now' : 'New job near you',
      body: `${job.title} — review the request and send your price.`,
      referenceType: 'JOB_MATCH',
      referenceId: jobId,
    }, {
      channelId: 'job_offers',
      priority: 'high',
      interruptionLevel: 'time-sensitive',
      data: {
        type: 'NEW_JOB',
        deliveryMode: profile.isOnline ? 'LIVE_OFFER' : 'BACKGROUND_OFFER',
        jobId,
        categoryId: job.categoryId,
      },
    })
    matched += 1
  }

  for (const candidate of companyCandidates) {
    const companyId = candidate.companyId || candidate.providerId
    const company = companyById.get(companyId)
    if (!company) continue

    await deliverNotification({
      userId: company.userId,
      title: 'New company opportunity',
      body: `${job.title} — review the request and send a company quote.`,
      referenceType: 'JOB_MATCH',
      referenceId: jobId,
    }, {
      channelId: 'job_offers',
      priority: 'high',
      interruptionLevel: 'time-sensitive',
      data: {
        type: 'NEW_JOB',
        deliveryMode: 'COMPANY_OPPORTUNITY',
        jobId,
        categoryId: job.categoryId,
        companyId,
      },
    })
    matched += 1
  }

  await prisma.marketplaceJob.update({
    where: { id: jobId },
    data: { notifiedCount: matched, currentWave: 1, waveSentAt: new Date() },
  })

  if (matched === 0) {
    await createNotification({
      userId: job.customerId,
      title: 'No providers available right now',
      body: 'Try a future time or expand your search. Your job is still posted.',
      referenceType: 'JOB',
      referenceId: jobId,
    })
  }

  return { matched, totalCandidates: result.candidates.length }
}
