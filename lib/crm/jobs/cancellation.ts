import { prisma } from '@/lib/prisma'
import { cancelJob as cancelMarketplaceJob } from '@/lib/domain/job-lifecycle'
import { getCurrencyForCountry } from '@/lib/shared/money/money'

export type CrmJobSource = 'V1' | 'V2'

export interface CrmJobCancellationContext {
  source: CrmJobSource
  jobId: string
  targetType: 'JobPosting' | 'MarketplaceJob'
  title: string
  status: string
  countryCode: string
  currency: string
  amountMinor?: bigint
  hasFinancialImpact: boolean
  financialAlreadyReleased: boolean
  activeDispute: boolean
}

export async function inspectCrmJobCancellation(
  jobId: string,
  source: CrmJobSource
): Promise<CrmJobCancellationContext | null> {
  if (source === 'V2') {
    const job = await prisma.marketplaceJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        status: true,
        countryCode: true,
        budgetAmount: true,
        finalAuthorizedAmountCents: true,
      },
    })
    if (!job) return null

    const [escrow, payment, dispute] = await Promise.all([
      prisma.jobEscrow.findFirst({
        where: { jobId },
        orderBy: { createdAt: 'desc' },
        select: { totalAmount: true, currency: true, status: true },
      }),
      prisma.paymentIntent.findFirst({
        where: { jobId },
        orderBy: { createdAt: 'desc' },
        select: { status: true, amount: true, currency: true },
      }),
      prisma.marketplaceDispute.findUnique({
        where: { jobId },
        select: { status: true },
      }),
    ])

    const protectedEscrow = Boolean(
      escrow && ['PROTECTED', 'ON_HOLD', 'CASH_CONFIRMED'].includes(escrow.status)
    )
    const paidIntent = Boolean(
      payment && ['SUCCESS', 'REFUND_REQUIRED', 'REFUND_PROCESSING'].includes(payment.status)
    )
    const financialAlreadyReleased = Boolean(
      escrow && ['RELEASED', 'REFUNDED'].includes(escrow.status)
    )

    return {
      source,
      jobId,
      targetType: 'MarketplaceJob',
      title: job.title,
      status: job.status,
      countryCode: job.countryCode || 'LK',
      currency: escrow?.currency || payment?.currency || getCurrencyForCountry(job.countryCode || 'LK'),
      amountMinor:
        escrow?.totalAmount ??
        payment?.amount ??
        job.finalAuthorizedAmountCents ??
        job.budgetAmount ??
        undefined,
      hasFinancialImpact: protectedEscrow || paidIntent,
      financialAlreadyReleased,
      activeDispute: Boolean(dispute && dispute.status !== 'RESOLVED'),
    }
  }

  const job = await prisma.jobPosting.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      status: true,
      budget: true,
      customer: { select: { countryCode: true } },
    },
  })
  if (!job) return null

  const [dispute, ledgerCount] = await Promise.all([
    prisma.dispute.findFirst({
      where: {
        jobId,
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
      },
      select: { id: true },
    }),
    prisma.financialLedger.count({
      where: { referenceId: jobId },
    }),
  ])

  const countryCode = job.customer.countryCode || 'LK'
  return {
    source,
    jobId,
    targetType: 'JobPosting',
    title: job.title,
    status: job.status,
    countryCode,
    currency: getCurrencyForCountry(countryCode),
    amountMinor: BigInt(Math.max(0, Math.round(Number(job.budget || 0) * 100))),
    hasFinancialImpact: ledgerCount > 0,
    financialAlreadyReleased: false,
    activeDispute: Boolean(dispute),
  }
}

export async function executeCrmJobCancellation(input: {
  context: CrmJobCancellationContext
  actorId: string
  reason?: string
  approvalRequestId?: string
}): Promise<{ changed: boolean; previousStatus: string }> {
  const { context } = input

  if (context.source === 'V2') {
    if (context.status === 'CANCELLED') {
      return { changed: false, previousStatus: context.status }
    }

    const result = await cancelMarketplaceJob({
      jobId: context.jobId,
      actorId: input.actorId,
      actorType: 'STAFF',
      reason: input.reason || 'CRM cancellation',
      metadata: input.approvalRequestId
        ? { approvalRequestId: input.approvalRequestId }
        : undefined,
    })

    return {
      changed: true,
      previousStatus: result.previousStatus,
    }
  }

  return prisma.$transaction(async tx => {
    const locked = await tx.jobPosting.findUnique({
      where: { id: context.jobId },
      select: { id: true, status: true },
    })
    if (!locked) throw new Error('Job not found')

    if (locked.status === 'CANCELLED') {
      return { changed: false, previousStatus: locked.status }
    }
    if (locked.status === 'COMPLETED' || locked.status === 'IN_PROGRESS') {
      throw new Error(`Cannot cancel classic job from ${locked.status}`)
    }
    if (!['OPEN', 'ASSIGNED'].includes(locked.status)) {
      throw new Error(`Classic job cannot be cancelled from ${locked.status}`)
    }

    const changed = await tx.jobPosting.updateMany({
      where: { id: context.jobId, status: locked.status },
      data: { status: 'CANCELLED' },
    })
    if (changed.count !== 1) throw new Error('Job state changed concurrently')

    await tx.assignment.updateMany({
      where: {
        jobId: context.jobId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      data: { status: 'CANCELLED' },
    })

    return { changed: true, previousStatus: locked.status }
  })
}
