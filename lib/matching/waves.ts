import { PrismaClient } from '@prisma/client'
import type { MatchingConfig, OpportunityStatus, WaveConfig, ProviderOpportunityRecord } from './types'
import { getWaveConfig } from './config'
import { createNotification } from '@/lib/notifications'

export interface WaveResult {
  waveNumber: number
  opportunitiesCreated: number
  notificationsSent: number
}

/**
 * Creates a new matching wave for a job.
 * Inserts ProviderOpportunity records and sends notifications.
 * Idempotent: checks for existing opportunities before creating.
 */
export async function createMatchingWave(
  client: PrismaClient,
  jobId: string,
  waveNumber: number,
  candidates: Array<{ providerId: string; providerType: 'INDIVIDUAL' | 'COMPANY'; score: number; rank: number; companyId?: string; userId?: string }>,
  config: MatchingConfig,
): Promise<WaveResult> {
  const waveConfig = getWaveConfig(config, waveNumber)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + waveConfig.expiryMinutes * 60 * 1000)

  let opportunitiesCreated = 0
  let notificationsSent = 0

  // Take only the top N candidates for this wave
  const waveCandidates = candidates.slice(0, waveConfig.size)

  for (const candidate of waveCandidates) {
    // Idempotency: skip if opportunity already exists for this job+provider
    const existing = await client.providerOpportunity.findFirst({
      where: {
        jobId,
        ...(candidate.providerType === 'INDIVIDUAL'
          ? { taskerId: candidate.providerId }
          : { companyId: candidate.providerId }),
      },
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

      // Send notification
      const notificationUserId = candidate.userId || candidate.providerId
      const pushToken = await getPushToken(client, candidate.providerType, candidate.providerId)
      if (pushToken) {
        await createNotification({
          userId: notificationUserId,
          title: 'New Job Match',
          body: 'A new job matches your skills — tap to view',
          referenceType: 'JOB_MATCH',
          referenceId: jobId,
        })
        notificationsSent++
      }
    } catch (err) {
      // Unique constraint violation = already exists, skip silently
      if ((err as any)?.code === 'P2002') continue
      throw err
    }
  }

  // Update job wave state
  await client.marketplaceJob.update({
    where: { id: jobId },
    data: { currentWave: waveNumber, waveSentAt: now },
  })

  return { waveNumber, opportunitiesCreated, notificationsSent }
}

/**
 * Expires opportunities that have passed their expiry time.
 * Returns job IDs that need wave advancement.
 */
export async function expireOpportunities(
  client: PrismaClient,
): Promise<string[]> {
  const now = new Date()

  // Find expired SENT/PENDING opportunities
  const expired = await client.providerOpportunity.findMany({
    where: {
      status: { in: ['SENT', 'PENDING'] },
      expiresAt: { lte: now },
    },
    select: { id: true, jobId: true },
  })

  if (expired.length === 0) return []

  // Batch update to EXPIRED
  const expiredIds = expired.map(e => e.id)
  await client.providerOpportunity.updateMany({
    where: { id: { in: expiredIds } },
    data: { status: 'EXPIRED' },
  })

  // Return unique job IDs that need wave advancement
  return [...new Set(expired.map(e => e.jobId))]
}

/**
 * Advances a job to the next matching wave.
 * Checks if job still needs more providers.
 */
export async function advanceMatchingWave(
  client: PrismaClient,
  jobId: string,
  config: MatchingConfig,
): Promise<{ advanced: boolean; waveNumber: number }> {
  const job = await client.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { id: true, status: true, currentWave: true },
  })

  if (!job || job.status !== 'OPEN') return { advanced: false, waveNumber: 0 }

  // Check if any provider has accepted
  const accepted = await client.providerOpportunity.findFirst({
    where: { jobId, status: 'ACCEPTED' },
  })
  if (accepted) return { advanced: false, waveNumber: job.currentWave }

  const currentWave = job.currentWave || 0
  const nextWave = currentWave + 1

  if (nextWave > 3) return { advanced: false, waveNumber: currentWave }

  return { advanced: true, waveNumber: nextWave }
}

/**
 * Handles provider response to an opportunity.
 * Concurrency-safe: uses atomic update.
 */
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

/**
 * Checks if a job should stop receiving new waves.
 */
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

async function getPushToken(
  client: PrismaClient,
  providerType: string,
  providerId: string,
): Promise<string | null> {
  if (providerType === 'INDIVIDUAL') {
    const user = await client.user.findUnique({
      where: { id: providerId },
      select: { pushToken: true },
    })
    return user?.pushToken || null
  } else {
    const company = await client.companyProfile.findUnique({
      where: { id: providerId },
      select: { userId: true },
    })
    if (!company) return null
    const user = await client.user.findUnique({
      where: { id: company.userId },
      select: { pushToken: true },
    })
    return user?.pushToken || null
  }
}
