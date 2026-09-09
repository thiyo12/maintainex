import { prisma } from './prisma'
import { createNotification } from './notifications'
import { sendExpoPush } from './push'
import { findCandidates } from './matching'

/**
 * Notify individual providers using the same canonical matching engine exposed
 * to customers. Company candidates remain in the canonical result but are not
 * inserted into JobMatchQueue because that legacy queue is TaskerProfile-only.
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

  let individualCandidates = result.candidates.filter((candidate) => candidate.providerType === 'INDIVIDUAL')

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
      ? individualCandidates.filter((candidate) => candidate.userId === target.userId)
      : []
  }

  const userIds = individualCandidates.map((candidate) => candidate.userId || candidate.providerId)
  const profiles = await prisma.taskerProfile.findMany({
    where: { userId: { in: userIds } },
    include: { user: { select: { pushToken: true } } },
  })
  const profileByUser = new Map(profiles.map((profile) => [profile.userId, profile]))

  await prisma.jobMatchQueue.deleteMany({ where: { jobId } })

  const pushTitle = `New job near you 🔔`
  const estText = Number(job.budgetAmount) > 0 ? Number(job.budgetAmount).toLocaleString() : 'negotiable'
  const pushBody = `${job.title} — Est. LKR ${estText}. Tap to quote.`

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

    await createNotification({
      userId,
      title: pushTitle,
      body: job.title,
      referenceType: 'JOB_MATCH',
      referenceId: jobId,
    })
    if (profile.user.pushToken) {
      await sendExpoPush(profile.user.pushToken, pushTitle, pushBody, {
        type: 'NEW_JOB',
        jobId,
        categoryId: job.categoryId,
      })
    }
    matched += 1
  }

  await prisma.marketplaceJob.update({
    where: { id: jobId },
    data: { notifiedCount: matched, currentWave: 1, waveSentAt: new Date() },
  })

  if (matched === 0) {
    await createNotification({
      userId: job.customerId,
      title: 'No taskers available right now',
      body: 'Try expanding your search or check back later. Your job is still posted.',
    })
  }

  return { matched, totalCandidates: result.candidates.length }
}
