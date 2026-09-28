import { prisma } from '@/lib/prisma'
import { type Currency } from '@/lib/shared/money/money'
import { resolvePricingConfig } from '@/lib/pricing/rules'
import { Prisma, PrismaClient } from '@prisma/client'
import { recordJobLifecycleEvent } from '@/lib/domain/job-lifecycle-audit'
import { resolveProviderActor } from '@/lib/domain/job-actors'
import { fundEscrow, releaseEscrow, refundEscrow, expirePendingEscrow, completeAndReleaseEscrow } from '@/lib/finance/escrow/escrow-service'
import { hasCompanyPermission, isValidCompanyRole } from '@/lib/phase6/rbac'


export type JobStatus = 'OPEN' | 'QUOTE_ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type QuoteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'
export type WorkspaceStatus = 'ACCEPTED' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'COMPLETION_REQUESTED' | 'COMPLETED' | 'DISPUTED'
export type EscrowStatus = 'PENDING_PAYMENT' | 'PROTECTED' | 'ON_HOLD' | 'RELEASED' | 'REFUNDED' | 'CANCELLED'
export type ActorType = 'CUSTOMER' | 'PROVIDER' | 'COMPANY' | 'STAFF' | 'SYSTEM'

async function hasCompanyJobManagement(
  db: PrismaClient | Prisma.TransactionClient,
  companyId: string,
  userId: string,
): Promise<boolean> {
  const member = await db.teamMember.findFirst({
    where: { companyId, userId, status: 'ACTIVE' },
    select: { role: true },
  })
  return !!member &&
    isValidCompanyRole(member.role) &&
    hasCompanyPermission(member.role, 'jobs:manage')
}

async function isAssignedCompanyWorker(
  db: PrismaClient | Prisma.TransactionClient,
  companyId: string,
  jobId: string,
  userId: string,
  statuses: string[],
): Promise<boolean> {
  const assignment = await db.companyJobAssignment.findFirst({
    where: {
      companyId,
      jobId,
      workerUserId: userId,
      status: { in: statuses },
    },
    select: { id: true },
  })
  if (!assignment) return false

  const member = await db.teamMember.findFirst({
    where: { companyId, userId, status: 'ACTIVE' },
    select: { id: true },
  })
  return !!member
}

export interface TransitionContext {
  jobId: string
  actorId: string
  actorType: ActorType
  reason?: string
  metadata?: Record<string, unknown>
}

const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  OPEN: ['QUOTE_ACCEPTED', 'CANCELLED'],
  QUOTE_ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

const WORKSPACE_TRANSITIONS: Record<WorkspaceStatus, WorkspaceStatus[]> = {
  ACCEPTED: ['IN_PROGRESS', 'DISPUTED'],
  IN_PROGRESS: ['WAITING_CUSTOMER', 'COMPLETION_REQUESTED', 'DISPUTED'],
  WAITING_CUSTOMER: ['IN_PROGRESS', 'COMPLETION_REQUESTED', 'DISPUTED'],
  COMPLETION_REQUESTED: ['COMPLETED', 'DISPUTED'],
  COMPLETED: [],
  DISPUTED: [],
}

const PROVIDER_ONLY_WORKSPACE: WorkspaceStatus[] = ['COMPLETION_REQUESTED']
const CUSTOMER_ONLY_WORKSPACE: WorkspaceStatus[] = ['IN_PROGRESS']

export function isValidJobTransition(from: JobStatus, to: JobStatus): boolean {
  return JOB_TRANSITIONS[from]?.includes(to) ?? false
}

export function isValidWorkspaceTransition(from: WorkspaceStatus, to: WorkspaceStatus): boolean {
  return WORKSPACE_TRANSITIONS[from]?.includes(to) ?? false
}

export function canActorPerformWorkspaceTransition(actorType: ActorType, targetStatus: WorkspaceStatus): boolean {
  if (PROVIDER_ONLY_WORKSPACE.includes(targetStatus)) return actorType === 'PROVIDER' || actorType === 'COMPANY'
  if (CUSTOMER_ONLY_WORKSPACE.includes(targetStatus)) return actorType === 'CUSTOMER'
  return true
}

export async function transitionMarketplaceJob(ctx: TransitionContext, targetStatus: JobStatus) {
  return prisma.$transaction(async (tx) => {
    const job = await tx.marketplaceJob.findUnique({ where: { id: ctx.jobId } })
    if (!job) throw new Error('Job not found')
    if (!isValidJobTransition(job.status as JobStatus, targetStatus)) {
      throw new Error(`Cannot transition job from ${job.status} to ${targetStatus}`)
    }

    const changed = await tx.marketplaceJob.updateMany({
      where: { id: ctx.jobId, status: job.status },
      data: { status: targetStatus },
    })
    if (changed.count !== 1) throw new Error('Job state changed concurrently')

    await recordJobLifecycleEvent(tx, {
      jobId: ctx.jobId,
      actorId: ctx.actorId,
      actorType: ctx.actorType,
      action: 'JOB_STATUS_CHANGED',
      fromState: job.status,
      toState: targetStatus,
      metadata: ctx.reason ? { reason: ctx.reason, ...ctx.metadata } : ctx.metadata,
    })

    return tx.marketplaceJob.findUniqueOrThrow({ where: { id: ctx.jobId } })
  })
}

export async function transitionJobWorkspace(ctx: TransitionContext, targetStatus: WorkspaceStatus) {
  return prisma.$transaction(async (tx) => {
    const job = await tx.marketplaceJob.findUnique({ where: { id: ctx.jobId } })
    if (!job) throw new Error('Job not found')
    if (!canActorPerformWorkspaceTransition(ctx.actorType, targetStatus)) {
      throw new Error(`Actor type ${ctx.actorType} cannot transition to ${targetStatus}`)
    }

    if (PROVIDER_ONLY_WORKSPACE.includes(targetStatus)) {
      const acceptedQuote = await tx.jobQuote.findFirst({
        where: { jobId: ctx.jobId, status: 'ACCEPTED' },
        select: { providerId: true, providerType: true },
      })
      if (!acceptedQuote) throw new Error('Unauthorized: no accepted provider for this job')

      let authorized = false
      if (acceptedQuote.providerType === 'INDIVIDUAL') {
        authorized = acceptedQuote.providerId === ctx.actorId && ctx.actorType === 'PROVIDER'
      } else if (ctx.actorType === 'COMPANY') {
        authorized = await isAssignedCompanyWorker(
          tx,
          acceptedQuote.providerId,
          ctx.jobId,
          ctx.actorId,
          ['IN_PROGRESS'],
        )
      }
      if (!authorized) throw new Error('Unauthorized: not the accepted provider for this job')
    }

    const workspace = await tx.jobWorkspace.findUnique({ where: { jobId: ctx.jobId } })
    if (!workspace) throw new Error('Workspace not found')
    if (!isValidWorkspaceTransition(workspace.progressStatus as WorkspaceStatus, targetStatus)) {
      throw new Error(`Cannot transition workspace from ${workspace.progressStatus} to ${targetStatus}`)
    }

    const changed = await tx.jobWorkspace.updateMany({
      where: { jobId: ctx.jobId, progressStatus: workspace.progressStatus },
      data: {
        progressStatus: targetStatus,
        ...(targetStatus === 'COMPLETION_REQUESTED' ? { completionRequestedAt: new Date() } : {}),
      },
    })
    if (changed.count !== 1) throw new Error('Workspace state changed concurrently')

    if (targetStatus === 'COMPLETED') {
      await tx.marketplaceJob.updateMany({
        where: { id: ctx.jobId, status: 'IN_PROGRESS' },
        data: { status: 'COMPLETED' },
      })
    }

    await recordJobLifecycleEvent(tx, {
      jobId: ctx.jobId,
      actorId: ctx.actorId,
      actorType: ctx.actorType,
      action: 'WORKSPACE_STATUS_CHANGED',
      fromState: workspace.progressStatus,
      toState: targetStatus,
      metadata: ctx.reason ? { reason: ctx.reason, ...ctx.metadata } : ctx.metadata,
    })

    return tx.jobWorkspace.findUniqueOrThrow({ where: { jobId: ctx.jobId } })
  })
}

export async function cancelJob(
  ctx: TransitionContext
): Promise<{ jobId: string; previousStatus: string }> {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: ctx.jobId } })
  if (!job) throw new Error('Job not found')

  if (ctx.actorType === 'CUSTOMER') {
    if (job.customerId !== ctx.actorId) throw new Error('Only the job owner can cancel this job')
  } else if (ctx.actorType === 'PROVIDER') {
    const acceptedQuote = await prisma.jobQuote.findFirst({
      where: { jobId: ctx.jobId, status: 'ACCEPTED', providerType: 'INDIVIDUAL' },
      select: { providerId: true },
    })
    if (!acceptedQuote || acceptedQuote.providerId !== ctx.actorId) {
      throw new Error('Only the accepted provider can cancel this job')
    }
  } else if (ctx.actorType === 'COMPANY') {
    const acceptedQuote = await prisma.jobQuote.findFirst({
      where: { jobId: ctx.jobId, status: 'ACCEPTED', providerType: 'COMPANY' },
      select: { providerId: true },
    })
    if (
      !acceptedQuote ||
      !(await hasCompanyJobManagement(prisma, acceptedQuote.providerId, ctx.actorId))
    ) {
      throw new Error('Only an authorized company manager can cancel this job')
    }
  } else if (ctx.actorType !== 'STAFF' && ctx.actorType !== 'SYSTEM') {
    throw new Error('Actor is not authorized to cancel this job')
  }

  if (job.status === 'CANCELLED') throw new Error('Job is already cancelled')
  if (job.status === 'COMPLETED') throw new Error('Cannot cancel a completed job')
  if (job.status === 'IN_PROGRESS') throw new Error('Cannot cancel after work has started')
  if (!['OPEN', 'QUOTE_ACCEPTED'].includes(job.status)) {
    throw new Error('Job cannot be cancelled in its current state')
  }

  const prepared = await prisma.$transaction(async (tx) => {
    const lockedRows = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT id, status
      FROM "MarketplaceJob"
      WHERE id = ${ctx.jobId}
      FOR UPDATE
    `
    const lockedJob = lockedRows[0]
    if (!lockedJob) throw new Error('Job not found')
    if (lockedJob.status === 'IN_PROGRESS') throw new Error('Cannot cancel after work has started')
    if (lockedJob.status === 'COMPLETED') throw new Error('Cannot cancel a completed job')
    if (lockedJob.status === 'CANCELLED') throw new Error('Job is already cancelled')
    if (!['OPEN', 'QUOTE_ACCEPTED'].includes(lockedJob.status)) {
      throw new Error('Job cannot be cancelled in its current state')
    }

    if (lockedJob.status === 'QUOTE_ACCEPTED') {
      const protectedEscrow = await tx.jobEscrow.findFirst({
        where: { jobId: ctx.jobId, status: 'PROTECTED' },
        select: { id: true },
      })
      if (protectedEscrow) {
        return { needsRefund: true, previousStatus: lockedJob.status }
      }
    }

    const claimed = await tx.marketplaceJob.updateMany({
      where: { id: ctx.jobId, status: lockedJob.status },
      data: { status: 'CANCELLED', isActive: false, responseState: 'resolved' },
    })
    if (claimed.count !== 1) throw new Error('Job state changed concurrently')

    await tx.paymentIntent.updateMany({
      where: { jobId: ctx.jobId, status: { in: ['CREATED', 'PENDING'] } },
      data: { status: 'CANCELLED' },
    })

    await tx.jobEscrow.updateMany({
      where: { jobId: ctx.jobId, status: 'PENDING_PAYMENT' },
      data: { status: 'CANCELLED' },
    })

    await tx.jobQuote.updateMany({
      where: { jobId: ctx.jobId, status: 'PENDING' },
      data: { status: 'REJECTED' },
    })
    await tx.jobQuote.updateMany({
      where: { jobId: ctx.jobId, status: 'ACCEPTED' },
      data: { status: 'WITHDRAWN' },
    })
    await tx.companyJobAssignment.updateMany({
      where: { jobId: ctx.jobId, status: { in: ['ASSIGNED', 'ACCEPTED'] } },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedReason: 'Job cancelled before work start',
      },
    })

    await recordJobLifecycleEvent(tx, {
      jobId: ctx.jobId,
      actorId: ctx.actorId,
      actorType: ctx.actorType,
      action: 'JOB_CANCELLED',
      fromState: lockedJob.status,
      toState: 'CANCELLED',
      metadata: { reason: ctx.reason ?? null, refunded: false },
    })

    return { needsRefund: false, previousStatus: lockedJob.status }
  })

  if (prepared.needsRefund) {
    await refundEscrow(ctx, ctx.jobId)
  }

  return { jobId: ctx.jobId, previousStatus: prepared.previousStatus }
}

export async function acceptJobQuote(ctx: TransitionContext, quoteId: string) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: ctx.jobId } })
  if (!job) throw new Error('Job not found')
  if (job.customerId !== ctx.actorId) throw new Error('Only the customer can accept a quote')
  if (job.status !== 'OPEN') throw new Error('Job is not open for quote acceptance')

  const quote = await prisma.jobQuote.findUnique({ where: { id: quoteId } })
  if (!quote || quote.jobId !== ctx.jobId) throw new Error('Quote not found for this job')
  if (quote.status !== 'PENDING') throw new Error('Quote is not in PENDING status')
  if (quote.price <= 0n) throw new Error('Quote price must be positive')

  const jobCountry = job.countryCode || 'GLOBAL'
  const pricingConfig = await resolvePricingConfig(prisma, jobCountry)

  if (jobCountry !== 'GLOBAL' && jobCountry !== pricingConfig.countryCode) {
    throw new Error(
      `PRICING_COUNTRY_MISMATCH: job country=${jobCountry} but resolved pricing config country=${pricingConfig.countryCode}. Refusing to proceed.`
    )
  }

  const serviceFee = (quote.price * BigInt(pricingConfig.commissionRateBps)) / 10000n
  const totalAmount = quote.price + serviceFee
  const existingEscrow = await prisma.jobEscrow.findFirst({
    where: { jobId: ctx.jobId, status: { in: ['CANCELLED', 'PENDING_PAYMENT'] } },
  })

  await prisma.$transaction(async (tx) => {
    const jobClaim = await tx.marketplaceJob.updateMany({
      where: { id: ctx.jobId, status: 'OPEN' },
      data: { status: 'QUOTE_ACCEPTED', approvedQuoteId: quoteId },
    })
    if (jobClaim.count !== 1) throw new Error('Job already has an accepted quote')

    const quoteClaim = await tx.jobQuote.updateMany({
      where: { id: quoteId, jobId: ctx.jobId, status: 'PENDING' },
      data: { status: 'ACCEPTED' },
    })
    if (quoteClaim.count !== 1) throw new Error('Quote is no longer available')

    await tx.jobQuote.updateMany({
      where: { jobId: ctx.jobId, id: { not: quoteId }, status: 'PENDING' },
      data: { status: 'REJECTED' },
    })

    await tx.jobWorkspace.upsert({
      where: { jobId: ctx.jobId },
      create: { jobId: ctx.jobId, progressStatus: 'ACCEPTED' },
      update: { progressStatus: 'ACCEPTED' },
    })

    if (existingEscrow) {
      await tx.jobEscrow.update({
        where: { id: existingEscrow.id },
        data: {
          quoteId: quote.id,
          providerId: quote.providerId,
          amount: quote.price,
          serviceFee,
          totalAmount,
          currency: pricingConfig.defaultCurrency as Currency,
          paymentMethod: 'CARD',
          status: 'PENDING_PAYMENT',
          heldAt: null,
          releasedAt: null,
          refundedAt: null,
          cashConfirmedAt: null,
        },
      })
    } else {
      await tx.jobEscrow.create({
        data: {
          jobId: ctx.jobId,
          quoteId: quote.id,
          customerId: job.customerId,
          providerId: quote.providerId,
          amount: quote.price,
          serviceFee,
          totalAmount,
          currency: pricingConfig.defaultCurrency as Currency,
          paymentMethod: 'CARD',
          status: 'PENDING_PAYMENT',
        },
      })
    }

    await recordJobLifecycleEvent(tx, {
      jobId: ctx.jobId,
      actorId: ctx.actorId,
      actorType: ctx.actorType,
      action: 'QUOTE_ACCEPTED',
      fromState: 'OPEN',
      toState: 'QUOTE_ACCEPTED',
      metadata: {
        quoteId,
        providerId: quote.providerId,
        providerType: quote.providerType,
        quoteAmountMinor: quote.price,
        serviceFeeMinor: serviceFee,
        totalAmountMinor: totalAmount,
        currency: pricingConfig.defaultCurrency,
      },
    })
  })

  const committedJob = await prisma.marketplaceJob.findUnique({ where: { id: ctx.jobId } })
  const committedQuote = await prisma.jobQuote.findUnique({ where: { id: quoteId } })
  return { job: committedJob!, quote: committedQuote! }
}

async function verifyDisputeAuthorization(
  job: { customerId: string },
  ctx: TransitionContext,
  tx?: Prisma.TransactionClient
) {
  const isCustomer = job.customerId === ctx.actorId
  const isStaff = ctx.actorType === 'STAFF'
  if (isCustomer || isStaff) return

  const db = tx ?? prisma
  const acceptedQuote = await db.jobQuote.findFirst({ where: { jobId: ctx.jobId, status: 'ACCEPTED' } })
  if (!acceptedQuote) throw new Error('No accepted quote')

  if (ctx.actorType === 'COMPANY') {
    if (acceptedQuote.providerType !== 'COMPANY') throw new Error('Quote is not a company quote')
    const [assignedWorker, manager] = await Promise.all([
      isAssignedCompanyWorker(
        db,
        acceptedQuote.providerId,
        ctx.jobId,
        ctx.actorId,
        ['IN_PROGRESS'],
      ),
      hasCompanyJobManagement(db, acceptedQuote.providerId, ctx.actorId),
    ])
    if (!assignedWorker && !manager) {
      throw new Error('Only the assigned worker or an authorized company manager can dispute this job')
    }
  } else {
    if (acceptedQuote.providerId !== ctx.actorId) throw new Error('Actor is not a participant in this job')
  }
}

/** @deprecated Use raiseJobDispute() for atomic dispute creation. Kept for backward compatibility. */
export async function holdEscrowForDispute(ctx: TransitionContext, jobId: string) {
  return raiseJobDispute(ctx, jobId)
}

export async function raiseJobDispute(
  ctx: TransitionContext,
  jobId: string
): Promise<{ escrowId: string; workspaceStatus: string }> {
  return prisma.$transaction(async (tx) => {
    const job = await tx.marketplaceJob.findUnique({ where: { id: jobId } })
    if (!job) throw new Error('Job not found')
    if (job.status !== 'IN_PROGRESS') {
      throw new Error('Dispute is only available after work has started')
    }

    await verifyDisputeAuthorization(job, ctx, tx)

    const workspace = await tx.jobWorkspace.findUnique({ where: { jobId } })
    if (!workspace) throw new Error('Workspace not found')
    if (!isValidWorkspaceTransition(workspace.progressStatus as WorkspaceStatus, 'DISPUTED')) {
      throw new Error(`Cannot dispute from workspace state ${workspace.progressStatus}`)
    }

    const escrow = await tx.jobEscrow.findFirst({ where: { jobId, status: 'PROTECTED' } })
    if (!escrow) throw new Error('No protected escrow found')
    if (escrow.paymentMethod === 'CASH') throw new Error('CASH_PAYMENT_DISABLED')

    const escrowClaimed = await tx.jobEscrow.updateMany({
      where: { id: escrow.id, status: 'PROTECTED' },
      data: { status: 'ON_HOLD' },
    })
    if (escrowClaimed.count !== 1) throw new Error('Escrow state changed concurrently')

    const wsClaimed = await tx.jobWorkspace.updateMany({
      where: { jobId, progressStatus: workspace.progressStatus },
      data: { progressStatus: 'DISPUTED' },
    })
    if (wsClaimed.count !== 1) throw new Error('Workspace state changed concurrently')

    await recordJobLifecycleEvent(tx, {
      jobId,
      actorId: ctx.actorId,
      actorType: ctx.actorType,
      action: 'DISPUTE_RAISED',
      fromState: workspace.progressStatus,
      toState: 'DISPUTED',
      metadata: {
        reason: ctx.reason ?? null,
        escrowId: escrow.id,
        escrowFromState: 'PROTECTED',
        escrowToState: 'ON_HOLD',
      },
    })

    return { escrowId: escrow.id, workspaceStatus: 'DISPUTED' }
  })
}
