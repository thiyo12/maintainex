import { PrismaClient } from '@prisma/client'
import type { MatchingConfig, OpportunityStatus, ProviderOpportunityRecord } from './types'
import { getWaveConfig } from './config'
import { deliverNotification } from '@/lib/notifications'

export interface WaveResult {
  waveNumber: number
  opportunitiesCreated: number
  notificationsSent: number
}

async function resolveNotificationUser(
  client: PrismaClient,
  candidate: { providerId: string; providerType: 'INDIVIDUAL' | 'COMPANY'; userId?: string },
): Promise<string | null> {
  if (candidate.userId) return candidate.userId
  if (candidate.providerType === 'INDIVIDUAL') return candidate.providerId

  const company = await client.companyProfile.findUnique({
    where: { id: candidate.providerId },
    select: { userId: true },
  })
  return company?.userId || null
}

/**
 * Create one provider opportunity wave and deliver a real in-app + push alert.
 * Idempotent per job/provider via ProviderOpportunity.
 */
export async function createMatchingWave(
  client: PrismaClient,
  jobId: string,
  waveNumber: number,
  candidates: Array<{
    providerId: string
    providerType: 'INDIVIDUAL' | 'COMPANY'
    score: number
    rank: number
    companyId?: string
    userId?: string
  }>,
  config: MatchingConfig,
): Promise<WaveResult> {
  const waveConfig = getWaveConfig(config, waveNumber)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + waveConfig.expiryMinutes * 60 * 1000)

  const job = await client.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { title: true, categoryId: true },
  })

  let opportunitiesCreated = 0
  let notificationsSent = 0
  const waveCandidates = candidates.slice(0, waveConfig.size)

  for (const candidate of waveCandidates) {
    const existing = await client.providerOpportunity.findFirst({
      where: {
        jobId,
        ...(candidate.providerType === 'INDIVIDUAL'
          ? { taskerId: candidate.providerId }
          : { companyId: candidate.providerId }),
      },
      select: { id: true },
    })
    if (existing) continue

    try {
      await client.providerOpportunity.create({
        data: {
          jobId,
          taskerId: candidate.providerType === 'INDIVIDUAL' ? candidate.providerId : null,
          companyId: candidate.providerType === 'COMPANY' ? candidate.providerId : null,
          providerType: candidate.providerType,
          waveNumber,
          status: 'SENT',
          sentAt: now,
          expiresAt,
          rankAtSend: candidate.rank,
          scoreSnapshot: candidate.score,
        },
      })
      opportunitiesCreated++

      const notificationUserId = await resolveNotificationUser(client, candidate)
      if (notificationUserId) {
        await deliverNotification({
          userId: notificationUserId,
          title: 'New job match',
          body: job?.title
            ? `${job.title} — review the request and send your price.`
            : 'A new job matches your services — review it and send your price.',
          referenceType: 'JOB_MATCH',
          referenceId: jobId,
        }, {
          channelId: 'job_offers',
          priority: 'high',
          interruptionLevel: 'time-sensitive',
          data: {
            type: 'NEW_JOB',
            jobId,
            categoryId: job?.categoryId || null,
            providerType: candidate.providerType,
            waveNumber,
          },
        })
        notificationsSent++
      }
    } catch (err) {
      if ((err as any)?.code === 'P2002') continue
      throw err
    }
  }

  await client.marketplaceJob.update({
    where: { id: jobId },
    data: { currentWave: waveNumber, waveSentAt: now },
  })

  return { waveNumber, opportunitiesCreated, notificationsSent }
}

export async function expireOpportunities(
  client: PrismaClient,
): Promise<string[]> {
  const now = new Date()

  const expired = await client.providerOpportunity.findMany({
    where: {
      status: { in: ['SENT', 'PENDING'] },
      expiresAt: { lte: now },
    },
    select: { id: true, jobId: true },
  })

  if (expired.length === 0) return []

  await client.providerOpportunity.updateMany({
    where: { id: { in: expired.map(e => e.id) } },
    data: { status: 'EXPIRED' },
  })

  return [...new Set(expired.map(e => e.jobId))]
}

export async function advanceMatchingWave(
  client: PrismaClient,
  jobId: string,
  _config: MatchingConfig,
): Promise<{ advanced: boolean; waveNumber: number }> {
  const job = await client.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { id: true, status: true, currentWave: true },
  })

  if (!job || job.status !== 'OPEN') return { advanced: false, waveNumber: 0 }

  const accepted = await client.providerOpportunity.findFirst({
    where: { jobId, status: 'ACCEPTED' },
  })
  if (accepted) return { advanced: false, waveNumber: job.currentWave }

  const currentWave = job.currentWave || 0
  const nextWave = currentWave + 1

  if (nextWave > 3) return { advanced: false, waveNumber: currentWave }

  return { advanced: true, waveNumber: nextWave }
}

export async function respondToOpportunity(
  client: PrismaClient,
  jobId: string,
  providerId: string,
  providerType: 'INDIVIDUAL' | 'COMPANY',
  response: 'ACCEPTED' | 'DECLINED',
): Promise<{ success: boolean; error?: string }> {
  const whereClause = providerType === 'INDIVIDUAL'
    ? { jobId, taskerId: providerId }
    : { jobId, companyId: providerId }

  const opportunity = await client.providerOpportunity.findFirst({
    where: whereClause,
  })

  if (!opportunity) return { success: false, error: 'Opportunity not found' }
  if (opportunity.status === 'EXPIRED') return { success: false, error: 'Opportunity expired' }
  if (opportunity.status === 'ACCEPTED' || opportunity.status === 'DECLINED') {
    return { success: false, error: 'Already responded' }
  }

  await client.providerOpportunity.update({
    where: { id: opportunity.id },
    data: {
      status: response,
      response,
      respondedAt: new Date(),
    },
  })

  return { success: true }
}

export async function shouldStopWaves(
  client: PrismaClient,
  jobId: string,
): Promise<{ stop: boolean; reason?: string }> {
  const job = await client.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { status: true, currentWave: true },
  })

  if (!job) return { stop: true, reason: 'Job not found' }
  if (job.status !== 'OPEN') return { stop: true, reason: `Job status: ${job.status}` }
  if ((job.currentWave || 0) >= 3) return { stop: true, reason: 'All waves exhausted' }

  const accepted = await client.providerOpportunity.findFirst({
    where: { jobId, status: 'ACCEPTED' },
  })
  if (accepted) return { stop: true, reason: 'Provider accepted' }

  return { stop: false }
}

export type { OpportunityStatus, ProviderOpportunityRecord }
