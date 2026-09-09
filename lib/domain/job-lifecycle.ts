import { prisma } from '@/lib/prisma'
import { postLedgerTransaction } from '@/lib/ledger'
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

export function canActorPerformWorkspaceTransition(actorType: ActorType, targetStatus: WorkspaceStatus): boolean {
  if (PROVIDER_ONLY_WORKSPACE.includes(targetStatus)) return actorType === 'PROVIDER' || actorType === 'COMPANY'
  if (CUSTOMER_ONLY_WORKSPACE.includes(targetStatus)) return actorType === 'CUSTOMER'
  return true
}

export async function transitionMarketplaceJob(ctx: TransitionContext, targetStatus: JobStatus) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: ctx.jobId } })
  if (!job) throw new Error('Job not found')
  if (!isValidJobTransition(job.status as JobStatus, targetStatus)) {
    throw new Error(`Cannot transition job from ${job.status} to ${targetStatus}`)
  }

  const result = await prisma.marketplaceJob.updateMany({
    where: { id: ctx.jobId, status: job.status },
    data: { status: targetStatus },
  })
  if (result.count !== 1) throw new Error('Job state changed concurrently')
  return prisma.marketplaceJob.findUniqueOrThrow({ where: { id: ctx.jobId } })
}

export async function transitionJobWorkspace(ctx: TransitionContext, targetStatus: WorkspaceStatus) {
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

  const changed = await prisma.jobWorkspace.updateMany({
    where: { jobId: ctx.jobId, progressStatus: workspace.progressStatus },
    data: { progressStatus: targetStatus },
  })
  if (changed.count !== 1) throw new Error('Workspace state changed concurrently')

  if (targetStatus === 'COMPLETED') {
    await prisma.marketplaceJob.updateMany({
      where: { id: ctx.jobId, status: 'IN_PROGRESS' },
      data: { status: 'COMPLETED' },
    })
  } else if (targetStatus === 'DISPUTED') {
    await prisma.marketplaceJob.updateMany({
      where: { id: ctx.jobId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      data: { status: 'CANCELLED' },
    })
  }

  return prisma.jobWorkspace.findUniqueOrThrow({ where: { jobId: ctx.jobId } })
}

export async function acceptJobQuote(ctx: TransitionContext, quoteId: string) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: ctx.jobId } })
  if (!job) throw new Error('Job not found')
  if (job.customerId !== ctx.actorId) throw new Error('Only the customer can accept a quote')
  if (job.status !== 'OPEN') throw new Error('Job is not open for quote acceptance')

  const quote = await prisma.jobQuote.findUnique({ where: { id: quoteId } })
  if (!quote || quote.jobId !== ctx.jobId) throw new Error('Quote not found for this job')
  if (quote.status !== 'PENDING') throw new Error('Quote is not in PENDING status')

  const serviceFee = (quote.price * 1000n) / 10000n
  const totalAmount = quote.price + serviceFee
  const existingEscrow = await prisma.jobEscrow.findFirst({
    where: { jobId: ctx.jobId, status: { in: ['CANCELLED', 'PENDING_PAYMENT'] } },
  })

  await prisma.$transaction(async (tx) => {
    const jobClaim = await tx.marketplaceJob.updateMany({
      where: { id: ctx.jobId, status: 'OPEN' },
      data: { status: 'QUOTE_ACCEPTED' },
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
          serviceFee,
          totalAmount,
          status: 'PENDING_PAYMENT',
        },
      })
    }
  })

  return { job, quote }
}

export async function fundEscrow(ctx: TransitionContext, jobId: string) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Job not found')
  if (job.customerId !== ctx.actorId) throw new Error('Only the customer can deposit escrow')
  if (job.status !== 'QUOTE_ACCEPTED' && job.status !== 'IN_PROGRESS') throw new Error('Job not ready for escrow')

  const quote = await prisma.jobQuote.findFirst({ where: { jobId, status: 'ACCEPTED' } })
  if (!quote) throw new Error('No accepted quote found')

  const escrow = await prisma.jobEscrow.findFirst({ where: { jobId } })
  if (escrow && !['PENDING_PAYMENT', 'CANCELLED'].includes(escrow.status)) throw new Error('Escrow already active')

  const serviceFee = escrow?.serviceFee ?? (quote.price * 1000n) / 10000n
  const totalAmount = escrow?.totalAmount ?? (quote.price + serviceFee)
  const totalMajor = bigIntToSafeNumber(totalAmount) / 100

  await prisma.$transaction(async (tx) => {
    await postLedgerTransaction({
      entries: [
        { accountId: `customer:${ctx.actorId}`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: totalAmount },
        { accountId: `escrow:${jobId}`, accountType: 'ESCROW', entryType: 'CREDIT', amount: totalAmount },
      ],
      referenceType: 'ESCROW_DEPOSIT',
      referenceId: jobId,
      idempotencyKey: `escrow-deposit:${jobId}`,
      description: `Escrow deposit for job ${jobId}`,
      createdBy: ctx.actorId,
    }, tx)

    await tx.customerWallet.update({
      where: { userId: ctx.actorId },
      data: { balance: { decrement: totalMajor } },
    })

    if (escrow) {
      const claimed = await tx.jobEscrow.updateMany({
        where: { id: escrow.id, status: { in: ['PENDING_PAYMENT', 'CANCELLED'] } },
        data: { status: 'PROTECTED', heldAt: new Date(), amount: quote.price, serviceFee, totalAmount },
      })
      if (claimed.count !== 1) throw new Error('Escrow state changed concurrently')
    } else {
      await tx.jobEscrow.create({
        data: {
          jobId,
          quoteId: quote.id,
          customerId: ctx.actorId,
          providerId: quote.providerId,
          amount: quote.price,
          serviceFee,
          totalAmount,
          status: 'PROTECTED',
          heldAt: new Date(),
        },
      })
    }

    await tx.marketplaceJob.updateMany({
      where: { id: jobId, status: { in: ['QUOTE_ACCEPTED', 'IN_PROGRESS'] } },
      data: { status: 'IN_PROGRESS' },
    })

    const legacyWallet = await tx.customerWallet.findUnique({ where: { userId: ctx.actorId }, select: { balance: true } })
    if (legacyWallet) {
      await tx.walletTransaction.create({
        data: {
          userId: ctx.actorId,
          walletType: 'CUSTOMER',
          type: 'DEBIT',
          amount: totalMajor,
          balanceBefore: legacyWallet.balance + totalMajor,
          balanceAfter: legacyWallet.balance,
          reference: `Escrow deposit for job ${jobId}`,
          referenceType: 'ESCROW_DEPOSIT',
          referenceId: jobId,
        },
      })
    }
  })

  return { success: true, totalAmount }
}

export async function releaseEscrow(
  ctx: TransitionContext,
  jobId: string,
  options?: { cashConfirmed?: boolean }
) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Job not found')
  if (job.customerId !== ctx.actorId) throw new Error('Only the customer can release escrow')

  const escrow = await prisma.jobEscrow.findFirst({ where: { jobId, status: 'PROTECTED' } })
  if (!escrow) throw new Error('No protected escrow found')

  const { getProviderCommissionRate } = await import('@/lib/mxid')
  const rate = Math.max(0, Math.min(100, await getProviderCommissionRate(escrow.providerId)))
  const rateBps = BigInt(Math.round(rate * 100))
  const commissionCents = (escrow.amount * rateBps) / 10000n
  const netCents = escrow.amount - commissionCents
  const platformCents = commissionCents + escrow.serviceFee
  const commissionMajor = bigIntToSafeNumber(commissionCents) / 100
  const netMajor = bigIntToSafeNumber(netCents) / 100

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.jobEscrow.updateMany({
      where: { id: escrow.id, status: 'PROTECTED' },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
        ...(options?.cashConfirmed ? { cashConfirmedAt: new Date() } : {}),
      },
    })
    if (claimed.count !== 1) throw new Error('Escrow already released or state changed')

    await tx.providerWallet.upsert({
      where: { userId: escrow.providerId },
      create: { userId: escrow.providerId, availableBalance: 0 },
      update: {},
    })

    const ledgerEntries: Array<{ accountId: string; accountType: string; entryType: 'CREDIT' | 'DEBIT'; amount: bigint }> = [
      { accountId: `escrow:${escrow.id}`, accountType: 'ESCROW', entryType: 'DEBIT', amount: escrow.totalAmount },
      { accountId: `provider:${escrow.providerId}`, accountType: 'PROVIDER_WALLET', entryType: 'CREDIT', amount: netCents },
    ]
    if (platformCents > 0n) {
      ledgerEntries.push({ accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: platformCents })
    }

    await postLedgerTransaction({
      entries: ledgerEntries,
      referenceType: 'ESCROW_RELEASE',
      referenceId: escrow.id,
      idempotencyKey: `escrow-release:${escrow.id}`,
      description: `Escrow release for job ${jobId}`,
      createdBy: ctx.actorId,
      metadata: JSON.stringify({ serviceFeeCents: escrow.serviceFee.toString(), commissionCents: commissionCents.toString() }),
    }, tx)

    const providerWallet = await tx.providerWallet.update({
      where: { userId: escrow.providerId },
      data: { availableBalance: { increment: netMajor } },
      select: { availableBalance: true },
    })
    await tx.walletTransaction.create({
      data: {
        userId: escrow.providerId,
        walletType: 'PROVIDER',
        type: 'CREDIT',
        amount: netMajor,
        balanceBefore: providerWallet.availableBalance - netMajor,
        balanceAfter: providerWallet.availableBalance,
        reference: commissionCents > 0n
          ? `Escrow release for job ${jobId} (${rate}% commission: LKR ${commissionMajor})`
          : `Escrow release for job ${jobId}`,
        referenceType: 'ESCROW_RELEASE',
        referenceId: escrow.id,
      },
    })

    await tx.marketplaceJob.updateMany({
      where: { id: jobId, status: 'IN_PROGRESS' },
      data: { status: 'COMPLETED' },
    })

    if (commissionCents > 0n) {
      await tx.commissionSettlement.create({
        data: {
          jobId,
          escrowId: escrow.id,
          providerId: escrow.providerId,
          customerId: escrow.customerId,
          jobAmount: escrow.amount,
          commissionRate: rate,
          commissionAmount: commissionCents,
          status: 'PENDING',
        },
      })
    }
  })

  return { commission: commissionMajor, netAmount: netMajor, commissionCents, netCents, providerId: escrow.providerId }
}

export async function refundEscrow(ctx: TransitionContext, jobId: string) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Job not found')
  if (job.customerId !== ctx.actorId && ctx.actorType !== 'STAFF') throw new Error('Only the customer or staff can refund escrow')

  const escrow = await prisma.jobEscrow.findFirst({
    where: { jobId, status: { in: ['PROTECTED', 'PENDING_PAYMENT', 'ON_HOLD'] } },
  })
  if (!escrow) throw new Error('No refundable escrow found')

  if (escrow.status === 'PENDING_PAYMENT') {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.jobEscrow.updateMany({
        where: { id: escrow.id, status: 'PENDING_PAYMENT' },
        data: { status: 'CANCELLED' },
      })
      if (claimed.count !== 1) throw new Error('Escrow state changed concurrently')
      await tx.marketplaceJob.updateMany({
        where: { id: jobId, status: { not: 'COMPLETED' } },
        data: { status: 'CANCELLED' },
      })
      await tx.jobQuote.updateMany({
        where: { id: escrow.quoteId, status: 'ACCEPTED' },
        data: { status: 'WITHDRAWN' },
      })
    })
    return { refundAmount: 0, refundCents: 0n }
  }

  const refundCents = escrow.totalAmount
  const refundMajor = bigIntToSafeNumber(refundCents) / 100

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.jobEscrow.updateMany({
      where: { id: escrow.id, status: { in: ['PROTECTED', 'ON_HOLD'] } },
      data: { status: 'REFUNDED', refundedAt: new Date() },
    })
    if (claimed.count !== 1) throw new Error('Escrow already refunded or state changed')

    await postLedgerTransaction({
      entries: [
        { accountId: `escrow:${escrow.id}`, accountType: 'ESCROW', entryType: 'DEBIT', amount: refundCents },
        { accountId: `customer:${job.customerId}`, accountType: 'CUSTOMER_WALLET', entryType: 'CREDIT', amount: refundCents },
      ],
      referenceType: 'ESCROW_REFUND',
      referenceId: escrow.id,
      idempotencyKey: `escrow-refund:${escrow.id}`,
      description: `Escrow refund for job ${jobId}`,
      createdBy: ctx.actorId,
    }, tx)

    const customerWallet = await tx.customerWallet.update({
      where: { userId: job.customerId },
      data: { balance: { increment: refundMajor } },
      select: { balance: true },
    })
    await tx.walletTransaction.create({
      data: {
        userId: job.customerId,
        walletType: 'CUSTOMER',
        type: 'CREDIT',
        amount: refundMajor,
        balanceBefore: customerWallet.balance - refundMajor,
        balanceAfter: customerWallet.balance,
        reference: `Escrow refund for job ${jobId}`,
        referenceType: 'ESCROW_REFUND',
        referenceId: escrow.id,
      },
    })
    await tx.marketplaceJob.updateMany({
      where: { id: jobId, status: { not: 'COMPLETED' } },
      data: { status: 'CANCELLED' },
    })
    await tx.jobQuote.updateMany({
      where: { id: escrow.quoteId, status: 'ACCEPTED' },
      data: { status: 'WITHDRAWN' },
    })
  })

  return { refundAmount: refundMajor, refundCents }
}

export async function holdEscrowForDispute(ctx: TransitionContext, jobId: string) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Job not found')

  const isCustomer = job.customerId === ctx.actorId
  const isProvider = !!(await prisma.jobQuote.findFirst({
    where: { jobId, providerId: ctx.actorId, status: 'ACCEPTED' },
    select: { id: true },
  }))
  if (!isCustomer && !isProvider && ctx.actorType !== 'STAFF') throw new Error('Actor is not a participant in this job')

  const escrow = await prisma.jobEscrow.findFirst({ where: { jobId, status: 'PROTECTED' } })
  if (!escrow) throw new Error('No protected escrow found to hold')

  const claimed = await prisma.jobEscrow.updateMany({
    where: { id: escrow.id, status: 'PROTECTED' },
    data: { status: 'ON_HOLD' },
  })
  if (claimed.count !== 1) throw new Error('Escrow state changed concurrently')

  return { escrowId: escrow.id }
}
