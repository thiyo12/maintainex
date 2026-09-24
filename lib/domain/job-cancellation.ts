import { prisma } from '@/lib/prisma'
import { refundEscrow, resolveProviderActor, type ActorType } from '@/lib/domain/job-lifecycle'
import { blastJobToTaskers } from '@/lib/job-blast'
import { notifyJobCancelled } from '@/lib/notifications'

export type CancelActor = {
  kind: 'CUSTOMER' | 'PROVIDER'
  actorType: ActorType
  acceptedQuote: {
    id: string
    providerId: string
    providerType: string
    actorUserId: string | null
  } | null
}

export async function resolvePreStartCancelActor(jobId: string, userId: string): Promise<CancelActor> {
  const job = await prisma.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { id: true, customerId: true, status: true },
  })
  if (!job) throw new Error('Job not found')
  if (['COMPLETED', 'CANCELLED'].includes(job.status)) throw new Error('Job can no longer be cancelled')

  const [workspace, activePin, acceptedQuote] = await Promise.all([
    prisma.jobWorkspace.findUnique({ where: { jobId }, select: { progressStatus: true } }),
    prisma.jobVerificationPin.findFirst({
      where: { jobId, status: 'ACTIVE' },
      orderBy: { version: 'desc' },
      select: { workStartVerifiedAt: true },
    }),
    prisma.jobQuote.findFirst({
      where: { jobId, status: 'ACCEPTED' },
      select: { id: true, providerId: true, providerType: true, actorUserId: true },
    }),
  ])

  if (activePin?.workStartVerifiedAt || (workspace && workspace.progressStatus !== 'ACCEPTED')) {
    throw new Error('Work has already started. Use the dispute/support flow instead of cancellation.')
  }

  if (job.customerId === userId) {
    return { kind: 'CUSTOMER', actorType: 'CUSTOMER', acceptedQuote }
  }

  const providerActor = await resolveProviderActor(jobId, userId)
  if (!providerActor) throw new Error('You are not allowed to cancel this job')
  return { kind: 'PROVIDER', actorType: providerActor, acceptedQuote }
}

async function providerRecipientUserId(quote: CancelActor['acceptedQuote']): Promise<string | null> {
  if (!quote) return null
  if (quote.providerType === 'INDIVIDUAL') return quote.providerId
  if (quote.actorUserId) return quote.actorUserId
  const company = await prisma.companyProfile.findUnique({
    where: { id: quote.providerId },
    select: { userId: true },
  })
  return company?.userId || null
}

export async function cancelJobBeforeStart(jobId: string, userId: string) {
  const actor = await resolvePreStartCancelActor(jobId, userId)
  const job = await prisma.marketplaceJob.findUniqueOrThrow({
    where: { id: jobId },
    select: { id: true, customerId: true, title: true },
  })

  const activeEscrow = await prisma.jobEscrow.findFirst({
    where: {
      jobId,
      status: { in: ['PENDING_PAYMENT', 'PROTECTED', 'ON_HOLD'] },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (actor.kind === 'CUSTOMER') {
    if (activeEscrow) {
      await refundEscrow({ jobId, actorId: userId, actorType: 'CUSTOMER' }, jobId)
    } else {
      await prisma.marketplaceJob.updateMany({
        where: { id: jobId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        data: { status: 'CANCELLED', isActive: false },
      })
      await prisma.jobQuote.updateMany({
        where: { jobId, status: 'PENDING' },
        data: { status: 'WITHDRAWN' },
      })
    }

    await prisma.$transaction([
      prisma.jobWorkspace.deleteMany({ where: { jobId, progressStatus: 'ACCEPTED' } }),
      prisma.jobVerificationPin.updateMany({
        where: { jobId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      }),
      prisma.marketplaceJob.updateMany({
        where: { id: jobId },
        data: { isActive: false, approvedQuoteId: null, targetTaskerId: null },
      }),
    ])

    const providerUserId = await providerRecipientUserId(actor.acceptedQuote)
    if (providerUserId) {
      await notifyJobCancelled(
        jobId,
        providerUserId,
        'Job Cancelled',
        `The customer cancelled "${job.title}" before work started.`,
      )
    }

    return { state: 'CANCELLED', reopened: false }
  }

  if (!actor.acceptedQuote) throw new Error('No accepted provider quote found')

  if (activeEscrow) {
    await refundEscrow({ jobId, actorId: userId, actorType: actor.actorType }, jobId)
  }

  await prisma.$transaction([
    prisma.jobQuote.updateMany({
      where: { id: actor.acceptedQuote.id },
      data: { status: 'WITHDRAWN' },
    }),
    prisma.jobWorkspace.deleteMany({ where: { jobId } }),
    prisma.jobVerificationPin.updateMany({
      where: { jobId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    }),
    prisma.companyJobAssignment.updateMany({
      where: { jobId, status: { in: ['ASSIGNED', 'ACCEPTED'] } },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedReason: 'Provider cancelled before work start' },
    }),
    prisma.jobMatchQueue.deleteMany({ where: { jobId } }),
    prisma.providerOpportunity.deleteMany({ where: { jobId } }),
    prisma.marketplaceJob.update({
      where: { id: jobId },
      data: {
        status: 'OPEN',
        isActive: true,
        approvedQuoteId: null,
        targetTaskerId: null,
        currentWave: 0,
        waveSentAt: null,
        notifiedCount: 0,
        responseState: 'awaiting',
      },
    }),
  ])

  await notifyJobCancelled(
    jobId,
    job.customerId,
    'Provider Cancelled · Job Reopened',
    `The selected provider cancelled "${job.title}" before work started. Your job is open again for new quotes.`,
  )

  await blastJobToTaskers(jobId, {
    excludeIndividualUserIds: actor.acceptedQuote.providerType === 'INDIVIDUAL' ? [actor.acceptedQuote.providerId] : [],
    excludeCompanyIds: actor.acceptedQuote.providerType === 'COMPANY' ? [actor.acceptedQuote.providerId] : [],
  })

  return { state: 'OPEN', reopened: true }
}
