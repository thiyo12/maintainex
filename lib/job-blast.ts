import { prisma } from './prisma'
import { createNotification } from './notifications'
import { sendExpoPush } from './push'
import { matchTaskerCandidates, resolveJobCategoryKeys } from './job-matching'

/**
 * Uber-style blast: notify eligible taskers for a job.
 * Uses the shared matching engine (verified + online + skill match + configurable
 * radius from `matching.radius_km`). If the job has a `targetTaskerId` (FLOW 1),
 * only that tasker is notified/assigned the match.
 */
export async function blastJobToTaskers(jobId: string): Promise<{ matched: number; totalCandidates: number }> {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job || job.status !== 'OPEN') return { matched: 0, totalCandidates: 0 }

  const { keys, name } = await resolveJobCategoryKeys(job.categoryId)
  if (keys.length === 0) return { matched: 0, totalCandidates: 0 }

  const candidates = await matchTaskerCandidates({
    matchKeys: keys,
    lat: job.latitude,
    lng: job.longitude,
    targetTaskerId: job.targetTaskerId || undefined,
  })

  await prisma.jobMatchQueue.deleteMany({ where: { jobId } })

  const pushTitle = `New ${name || 'job'} near you 🔔`
  const estText = Number(job.budgetAmount) > 0 ? Number(job.budgetAmount).toLocaleString() : 'negotiable'
  const pushBody = `${job.title} — Est. LKR ${estText}. Tap to quote.`

  const results = await Promise.all(
    candidates.map(async (t, i) => {
      try {
        await prisma.jobMatchQueue.create({
          data: {
            jobId,
            taskerId: t.profile.id,
            score: Math.round(t.score * 100),
            rank: i + 1,
            status: 'notified',
            notifiedAt: new Date(),
            wave: 1,
          },
        })
      } catch {
        return false
      }
      await createNotification({
        userId: t.profile.userId,
        title: pushTitle,
        body: job.title,
        referenceType: 'JOB_MATCH',
        referenceId: jobId,
      })
      if (t.profile.user.pushToken) {
        await sendExpoPush(t.profile.user.pushToken, pushTitle, pushBody, { type: 'NEW_JOB', jobId, categorySlug: job.categoryId })
      }
      return true
    })
  )
  const matched = results.filter(Boolean).length

  await prisma.marketplaceJob.update({
    where: { id: jobId },
    data: { notifiedCount: matched, currentWave: 1, waveSentAt: new Date() },
  })

  if (matched === 0) {
    const customer = await prisma.user.findUnique({ where: { id: job.customerId }, select: { pushToken: true } })
    if (customer?.pushToken) {
      await createNotification({
        userId: job.customerId,
        title: 'No taskers available right now',
        body: 'Try expanding your search or check back later. Your job is still posted.',
      })
    }
  }

  return { matched, totalCandidates: candidates.length }
}