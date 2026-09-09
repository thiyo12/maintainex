import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { postLedgerTransaction } from '@/lib/ledger'
import { readCanonicalProviderBalance, readCanonicalCustomerBalance } from '@/lib/financial-read'
import { bigIntToSafeNumber } from '@/lib/money'

export type JobStatus = 'OPEN' | 'QUOTE_ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export type QuoteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'

export type WorkspaceStatus = 'ACCEPTED' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'COMPLETION_REQUESTED' | 'COMPLETED' | 'DISPUTED'

export type EscrowStatus = 'PENDING_PAYMENT' | 'PROTECTED' | 'ON_HOLD' | 'RELEASED' | 'REFUNDED' | 'CANCELLED'

export type ActorType = 'CUSTOMER' | 'PROVIDER' | 'COMPANY' | 'STAFF' | 'SYSTEM'

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
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
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

export function canActorPerformWorkspaceTransition(
  actorType: ActorType,
  targetStatus: WorkspaceStatus
): boolean {
  if (PROVIDER_ONLY_WORKSPACE.includes(targetStatus)) {
    return actorType === 'PROVIDER' || actorType === 'COMPANY'
  }
  if (CUSTOMER_ONLY_WORKSPACE.includes(targetStatus)) {
    return actorType === 'CUSTOMER'
  }
  return true
}

export async function transitionMarketplaceJob(
  ctx: TransitionContext,
  targetStatus: JobStatus
) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: ctx.jobId } })
  if (!job) throw new Error('Job not found')

  if (!isValidJobTransition(job.status as JobStatus, targetStatus)) {
    throw new Error(`Cannot transition job from ${job.status} to ${targetStatus}`)
  }

  const updated = await prisma.marketplaceJob.update({
    where: {
      id: ctx.jobId,
      status: job.status,
    },
    data: { status: targetStatus },
  })

  return updated
}

export async function transitionJobWorkspace(
  ctx: TransitionContext,
  targetStatus: WorkspaceStatus
) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: ctx.jobId } })
  if (!job) throw new Error('Job not found')

  if (!canActorPerformWorkspaceTransition(ctx.actorType, targetStatus)) {
    throw new Error(`Actor type ${ctx.actorType} cannot transition to ${targetStatus}`)
  }

  const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId: ctx.jobId } })
  if (!workspace) throw new Error('Workspace not found')

  if (!isValidWorkspaceTransition(workspace.progressStatus as WorkspaceStatus, targetStatus)) {
    throw new Error(`Cannot transition workspace from ${workspace.progressStatus} to ${targetStatus}`)
  }

  const updated = await prisma.jobWorkspace.update({
    where: { jobId: ctx.jobId },
    data: { progressStatus: targetStatus },
  })

  if (targetStatus === 'COMPLETED') {
    await prisma.marketplaceJob.update({
      where: { id: ctx.jobId },
      data: { status: 'COMPLETED' },
    })
  }
  if (targetStatus === 'DISPUTED') {
    await prisma.marketplaceJob.update({
      where: { id: ctx.jobId },
      data: { status: 'CANCELLED' },
    })
  }

  return updated
}

export async function acceptJobQuote(
  ctx: TransitionContext,
  quoteId: string
) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: ctx.jobId } })
  if (!job) throw new Error('Job not found')
  if (job.customerId !== ctx.actorId) throw new Error('Only the customer can accept a quote')
  if (job.status !== 'OPEN') throw new Error('Job is not open for quote acceptance')

  const quote = await prisma.jobQuote.findUnique({ where: { id: quoteId } })
  if (!quote || quote.jobId !== ctx.jobId) throw new Error('Quote not found for this job')
  if (quote.status !== 'PENDING') throw new Error('Quote is not in PENDING status')

  const existingAccepted = await prisma.jobQuote.findFirst({
    where: { jobId: ctx.jobId, status: 'ACCEPTED' },
  })
  if (existingAccepted) throw new Error('Job already has an accepted quote')

  const quotePrice = bigIntToSafeNumber(quote.price)
  const serviceFeeCents = Math.round(quotePrice * 0.1 * 100) / 100
  const totalAmountCents = quotePrice + serviceFeeCents

  const existingEscrow = await prisma.jobEscrow.findFirst({
    where: { jobId: ctx.jobId, status: { in: ['CANCELLED', 'PENDING_PAYMENT'] } },
  })

  const result = await prisma.$transaction(async (tx) => {
    await tx.jobQuote.update({ where: { id: quoteId }, data: { status: 'ACCEPTED' } })
    await tx.jobQuote.updateMany({
      where: { jobId: ctx.jobId, id: { not: quoteId }, status: 'PENDING' },
      data: { status: 'REJECTED' },
    })
    await tx.marketplaceJob.update({
      where: { id: ctx.jobId, status: 'OPEN' },
      data: { status: 'QUOTE_ACCEPTED' },
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
          serviceFee: BigInt(Math.round(serviceFeeCents)),
          totalAmount: BigInt(Math.round(totalAmountCents)),
          status: 'PENDING_PAYMENT',
          heldAt: null,
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
          serviceFee: BigInt(Math.round(serviceFeeCents)),
          totalAmount: BigInt(Math.round(totalAmountCents)),
          status: 'PENDING_PAYMENT',
        },
      })
    }

    return { job, quote }
  })

  return result
}

export async function fundEscrow(
  ctx: TransitionContext,
  jobId: string
) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Job not found')
  if (job.customerId !== ctx.actorId) throw new Error('Only the customer can deposit escrow')
  if (job.status !== 'QUOTE_ACCEPTED' && job.status !== 'IN_PROGRESS') {
    throw new Error('Job not ready for escrow')
  }

  const quote = await prisma.jobQuote.findFirst({
    where: { jobId, status: 'ACCEPTED' },
  })
  if (!quote) throw new Error('No accepted quote found')

  const existingEscrow = await prisma.jobEscrow.findFirst({ where: { jobId } })
  if (existingEscrow && existingEscrow.status !== 'PENDING_PAYMENT' && existingEscrow.status !== 'CANCELLED') {
    throw new Error('Escrow already active')
  }

  const wallet = await prisma.customerWallet.findUnique({ where: { userId: ctx.actorId } })
  const canonicalBalance = await readCanonicalCustomerBalance(ctx.actorId)
  const currentBalance = canonicalBalance ? bigIntToSafeNumber(canonicalBalance.balance) : (wallet?.balance || 0)
  const quotePrice = bigIntToSafeNumber(quote.price)
  if (currentBalance < quotePrice) {
    throw new Error('Insufficient balance')
  }

  const serviceFeeCents = Math.round(quotePrice * 0.1 * 100) / 100
  const totalAmountCents = quotePrice + serviceFeeCents

  await prisma.$transaction(async (tx) => {
    await tx.customerWallet.update({
      where: { userId: ctx.actorId },
      data: { balance: { decrement: totalAmountCents } },
    })
    await tx.walletTransaction.create({
      data: {
        userId: ctx.actorId,
        walletType: 'CUSTOMER',
        type: 'DEBIT',
        amount: totalAmountCents,
        balanceBefore: currentBalance,
        balanceAfter: currentBalance - totalAmountCents,
        reference: `Escrow deposit for job ${jobId}`,
        referenceType: 'ESCROW_DEPOSIT',
        referenceId: jobId,
      },
    })
    if (existingEscrow) {
      await tx.jobEscrow.update({
        where: { id: existingEscrow.id },
        data: { status: 'PROTECTED', heldAt: new Date() },
      })
    } else {
      await tx.jobEscrow.create({
        data: {
          jobId,
          quoteId: quote.id,
          customerId: ctx.actorId,
          providerId: quote.providerId,
          amount: quote.price,
          serviceFee: BigInt(Math.round(serviceFeeCents)),
          totalAmount: BigInt(Math.round(totalAmountCents)),
          status: 'PROTECTED',
          heldAt: new Date(),
        },
      })
    }
    await tx.marketplaceJob.update({
      where: { id: jobId, status: 'QUOTE_ACCEPTED' },
      data: { status: 'IN_PROGRESS' },
    })

    await postLedgerTransaction({
      entries: [
        { accountId: `customer:${ctx.actorId}`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: BigInt(Math.round(totalAmountCents * 100)) },
        { accountId: `escrow:${jobId}`, accountType: 'ESCROW', entryType: 'CREDIT', amount: BigInt(Math.round(totalAmountCents * 100)) },
      ],
      referenceType: 'ESCROW_DEPOSIT',
      referenceId: jobId,
      idempotencyKey: `escrow-deposit:${jobId}`,
      description: `Escrow deposit for job ${jobId}`,
      createdBy: 'system',
    }, tx)
  })

  return { success: true }
}

export async function releaseEscrow(
  ctx: TransitionContext,
  jobId: string
) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Job not found')
  if (job.customerId !== ctx.actorId) throw new Error('Only the customer can release escrow')

  const escrow = await prisma.jobEscrow.findFirst({ where: { jobId, status: 'PROTECTED' } })
  if (!escrow) throw new Error('No protected escrow found')

  const escrowAmount = bigIntToSafeNumber(escrow.amount)
  const { computeCommission, getProviderCommissionRate } = await import('@/lib/mxid')
  const rate = await getProviderCommissionRate(escrow.providerId)
  const { commissionRate, commission, netAmount } = computeCommission(escrowAmount, rate)

  const providerWallet = await prisma.providerWallet.findUnique({
    where: { userId: escrow.providerId },
  })
  const canonicalProviderBalance = await readCanonicalProviderBalance(escrow.providerId)
  const currentBalance = canonicalProviderBalance ? bigIntToSafeNumber(canonicalProviderBalance.availableBalance) : (providerWallet?.availableBalance || 0)

  await prisma.$transaction(async (tx) => {
    await tx.jobEscrow.update({
      where: { id: escrow.id },
      data: { status: 'RELEASED', releasedAt: new Date() },
    })
    await tx.providerWallet.upsert({
      where: { userId: escrow.providerId },
      create: { userId: escrow.providerId, availableBalance: netAmount },
      update: { availableBalance: { increment: netAmount } },
    })
    await tx.walletTransaction.create({
      data: {
        userId: escrow.providerId,
        walletType: 'PROVIDER',
        type: 'CREDIT',
        amount: netAmount,
        balanceBefore: currentBalance,
        balanceAfter: currentBalance + netAmount,
        reference: commission > 0
          ? `Escrow release for job ${jobId} (${commissionRate}% commission: LKR ${commission})`
          : `Escrow release for job ${jobId}`,
        referenceType: 'ESCROW_RELEASE',
        referenceId: escrow.id,
      },
    })
    await tx.marketplaceJob.update({
      where: { id: jobId },
      data: { status: 'COMPLETED' },
    })

    await postLedgerTransaction({
      entries: [
        { accountId: `escrow:${escrow.id}`, accountType: 'ESCROW', entryType: 'DEBIT', amount: escrow.amount },
        { accountId: `provider:${escrow.providerId}`, accountType: 'PROVIDER_WALLET', entryType: 'CREDIT', amount: escrow.amount - BigInt(Math.round(commission * 100)) },
        { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: BigInt(Math.round(commission * 100)) },
      ],
      referenceType: 'ESCROW_RELEASE',
      referenceId: escrow.id,
      idempotencyKey: `escrow-release:${escrow.id}`,
      description: `Escrow release for job ${jobId}`,
      createdBy: 'system',
    }, tx)
  })

  return { commission, netAmount }
}

export async function refundEscrow(
  ctx: TransitionContext,
  jobId: string
) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Job not found')
  if (job.customerId !== ctx.actorId) throw new Error('Only the customer can refund escrow')

  const escrow = await prisma.jobEscrow.findFirst({
    where: { jobId, status: { in: ['PROTECTED', 'PENDING_PAYMENT'] } },
  })
  if (!escrow) throw new Error('No refundable escrow found')

  const refundAmount = bigIntToSafeNumber(escrow.totalAmount)
  const wallet = await prisma.customerWallet.findUnique({ where: { userId: job.customerId } })
  const canonicalRefundBalance = await readCanonicalCustomerBalance(job.customerId)
  const currentBalance = canonicalRefundBalance ? bigIntToSafeNumber(canonicalRefundBalance.balance) : (wallet?.balance || 0)

  await prisma.$transaction(async (tx) => {
    await tx.jobEscrow.update({
      where: { id: escrow.id },
      data: { status: 'REFUNDED', refundedAt: new Date() },
    })
    await tx.customerWallet.update({
      where: { userId: job.customerId },
      data: { balance: { increment: refundAmount } },
    })
    await tx.walletTransaction.create({
      data: {
        userId: job.customerId,
        walletType: 'CUSTOMER',
        type: 'CREDIT',
        amount: refundAmount,
        balanceBefore: currentBalance,
        balanceAfter: currentBalance + refundAmount,
        reference: `Escrow refund for job ${jobId}`,
        referenceType: 'ESCROW_REFUND',
        referenceId: escrow.id,
      },
    })
    await tx.marketplaceJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED' },
    })

    await postLedgerTransaction({
      entries: [
        { accountId: `escrow:${escrow.id}`, accountType: 'ESCROW', entryType: 'DEBIT', amount: escrow.totalAmount },
        { accountId: `customer:${job.customerId}`, accountType: 'CUSTOMER_WALLET', entryType: 'CREDIT', amount: escrow.totalAmount },
      ],
      referenceType: 'ESCROW_REFUND',
      referenceId: escrow.id,
      idempotencyKey: `escrow-refund:${escrow.id}`,
      description: `Escrow refund for job ${jobId}`,
      createdBy: 'system',
    }, tx)
  })

  return { refundAmount }
}
