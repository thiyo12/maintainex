import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { postLedgerTransaction } from '@/lib/finance/ledger/ledger-service'
import { bigIntToSafeNumber, type Currency } from '@/lib/shared/money/money'
import { getCommissionRate } from '@/lib/mxid'
import { recordJobLifecycleEvent } from '@/lib/domain/job-lifecycle-audit'
import { resolveProviderActor } from '@/lib/domain/job-actors'
import { resolvePayoutIdentity, recordWeeklySettlement } from '@/lib/finance/commissions/settlement-service'
import {
  assertProviderCashEligible,
  recordCashPlatformReceivable,
  recoverProviderCommissionFromOnlineEarnings,
} from '@/lib/finance/commissions/provider-balance-service'
import type { TransitionContext } from '@/lib/domain/job-lifecycle'
import { resolveEscrowFundingSource } from '@/lib/finance/payments/funding-source'

export async function fundEscrow(ctx: TransitionContext, jobId: string) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Job not found')
  if (job.customerId !== ctx.actorId) throw new Error('Only the customer can deposit escrow')
  if (job.status !== 'QUOTE_ACCEPTED') throw new Error('Job not ready for escrow')

  const quote = await prisma.jobQuote.findFirst({ where: { jobId, status: 'ACCEPTED' } })
  if (!quote) throw new Error('No accepted quote found')

  const escrow = await prisma.jobEscrow.findFirst({ where: { jobId } })
  if (!escrow) throw new Error('Escrow not initialized')
  if (!['PENDING_PAYMENT', 'CANCELLED'].includes(escrow.status)) throw new Error('Escrow already active')
  if (escrow.paymentMethod === 'CASH') throw new Error('Cash escrow cannot be wallet-funded')

  const customerWallet = await prisma.customerWallet.findUnique({
    where: { userId: ctx.actorId },
    select: { id: true },
  })
  if (!customerWallet) throw new Error('Customer wallet not found')

  const escrowCurrency = escrow.currency as Currency

  const canonicalBalance = await prisma.walletBalance.findFirst({
    where: { walletId: customerWallet.id, walletType: 'CUSTOMER', currency: escrowCurrency },
  })
  if (!canonicalBalance) {
    throw new Error(`WALLET_CURRENCY_NOT_FOUND: canonical ${escrowCurrency} balance does not exist for customer`)
  }

  const authorizedAmount = job.finalAuthorizedAmountCents ?? quote.totalCents ?? quote.price
  const serviceFee = escrow.serviceFee ?? 0n
  const totalAmount = escrow.totalAmount ?? (authorizedAmount + serviceFee)
  if (authorizedAmount <= 0n || totalAmount <= 0n) {
    throw new Error('Escrow total must be positive')
  }
  if (
    escrow.amount !== authorizedAmount ||
    totalAmount !== authorizedAmount + serviceFee
  ) {
    throw new Error('ESCROW_AUTHORIZED_AMOUNT_MISMATCH')
  }
  const totalMajor = bigIntToSafeNumber(totalAmount) / 100

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.jobEscrow.updateMany({
      where: {
        id: escrow.id,
        status: { in: ['PENDING_PAYMENT', 'CANCELLED'] },
        paymentMethod: { not: 'CASH' },
        amount: authorizedAmount,
        totalAmount,
      },
      data: { status: 'PROTECTED', heldAt: new Date(), amount: authorizedAmount, serviceFee, totalAmount },
    })
    if (claimed.count !== 1) throw new Error('Escrow state changed concurrently')

    await postLedgerTransaction({
      entries: [
        { accountId: customerWallet.id, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: totalAmount },
        { accountId: `escrow:${escrow.id}`, accountType: 'ESCROW', entryType: 'CREDIT', amount: totalAmount },
      ],
      currency: escrowCurrency,
      referenceType: 'ESCROW_DEPOSIT',
      referenceId: escrow.id,
      idempotencyKey: `escrow-deposit:${escrow.id}`,
      description: `Escrow deposit for job ${jobId}`,
      createdBy: ctx.actorId,
    }, tx)

    if (escrowCurrency === 'LKR') {
      const legacyWallet = await tx.customerWallet.update({
        where: { userId: ctx.actorId },
        data: { balance: { decrement: totalMajor } },
        select: { balance: true },
      })

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
          referenceId: escrow.id,
        },
      })
    }

    await recordJobLifecycleEvent(tx, {
      jobId,
      actorId: ctx.actorId,
      actorType: ctx.actorType,
      action: 'ESCROW_FUNDED',
      fromState: escrow.status,
      toState: 'PROTECTED',
      metadata: {
        escrowId: escrow.id,
        authorizedAmountMinor: authorizedAmount,
        totalAmountMinor: totalAmount,
        currency: escrowCurrency,
        fundingMethod: 'WALLET',
      },
    })
  })

  return { success: true, totalAmount, escrowId: escrow.id }
}

export async function confirmCashPayment(ctx: TransitionContext, jobId: string) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Job not found')
  if (job.customerId !== ctx.actorId) throw new Error('Only the customer can select cash payment')
  if (job.status !== 'QUOTE_ACCEPTED') throw new Error('Job is not ready for cash payment')

  const [quote, escrow] = await Promise.all([
    prisma.jobQuote.findFirst({ where: { jobId, status: 'ACCEPTED' } }),
    prisma.jobEscrow.findFirst({ where: { jobId }, orderBy: { createdAt: 'desc' } }),
  ])
  if (!quote) throw new Error('No accepted quote found')
  if (!escrow) throw new Error('Escrow not initialized')
  if (quote.providerType !== 'INDIVIDUAL' && quote.providerType !== 'COMPANY') {
    throw new Error('Quote provider type is invalid for cash payment')
  }

  const authorizedAmount = job.finalAuthorizedAmountCents ?? quote.totalCents ?? quote.price
  const serviceFee = escrow.serviceFee ?? 0n
  const totalAmount = authorizedAmount + serviceFee
  if (
    authorizedAmount <= 0n ||
    escrow.amount !== authorizedAmount ||
    escrow.totalAmount !== totalAmount ||
    quote.currency !== escrow.currency
  ) {
    throw new Error('ESCROW_AUTHORIZED_AMOUNT_MISMATCH')
  }

  if (escrow.paymentMethod === 'CASH' && escrow.status === 'CASH_CONFIRMED') {
    return {
      success: true,
      amountDue: escrow.totalAmount,
      currency: escrow.currency,
      escrowId: escrow.id,
      alreadyConfirmed: true,
    }
  }
  if (escrow.status !== 'PENDING_PAYMENT') {
    throw new Error('Payment method can no longer be changed')
  }

  const confirmedAt = new Date()
  await prisma.$transaction(async tx => {
    const lockedJobs = await tx.$queryRaw<Array<{ id: string; customerId: string; status: string }>>`
      SELECT id, "customerId", status
      FROM "MarketplaceJob"
      WHERE id = ${jobId}
      FOR UPDATE
    `
    const lockedJob = lockedJobs[0]
    if (!lockedJob) throw new Error('Job not found')
    if (lockedJob.customerId !== ctx.actorId) throw new Error('Only the customer can select cash payment')
    if (lockedJob.status !== 'QUOTE_ACCEPTED') throw new Error('Job is not ready for cash payment')

    await assertProviderCashEligible(tx, {
      providerId: quote.providerId,
      providerType: quote.providerType as 'INDIVIDUAL' | 'COMPANY',
      countryCode: job.countryCode || 'LK',
      currency: escrow.currency,
    })

    const claimed = await tx.jobEscrow.updateMany({
      where: {
        id: escrow.id,
        jobId,
        status: 'PENDING_PAYMENT',
        paymentMethod: { not: 'CASH' },
        amount: authorizedAmount,
        totalAmount,
      },
      data: {
        paymentMethod: 'CASH',
        status: 'CASH_CONFIRMED',
        cashConfirmedAt: confirmedAt,
        heldAt: null,
      },
    })
    if (claimed.count !== 1) throw new Error('Payment state changed concurrently')

    await tx.paymentIntent.updateMany({
      where: { jobId, status: { in: ['CREATED', 'PENDING'] } },
      data: { status: 'CANCELLED' },
    })

    await recordJobLifecycleEvent(tx, {
      jobId,
      actorId: ctx.actorId,
      actorType: ctx.actorType,
      action: 'CASH_PAYMENT_SELECTED',
      fromState: 'PENDING_PAYMENT',
      toState: 'CASH_CONFIRMED',
      metadata: {
        escrowId: escrow.id,
        cashDueMinor: totalAmount,
        providerAmountMinor: authorizedAmount,
        serviceFeeMinor: serviceFee,
        currency: escrow.currency,
      },
    })
  })

  return {
    success: true,
    amountDue: totalAmount,
    currency: escrow.currency,
    escrowId: escrow.id,
    alreadyConfirmed: false,
  }
}

export async function releaseEscrow(
  ctx: TransitionContext,
  jobId: string,
  options?: { cashConfirmed?: boolean }
) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Job not found')

  const isStaff = ctx.actorType === 'STAFF'
  if (!isStaff && job.customerId !== ctx.actorId) throw new Error('Only the customer or staff can release escrow')

  const allowedStatuses = isStaff ? ['PROTECTED', 'ON_HOLD'] : ['PROTECTED']
  const escrow = await prisma.jobEscrow.findFirst({
    where: { jobId, status: { in: allowedStatuses } },
  })
  if (!escrow) throw new Error('No releasable escrow found')

  // Cash does not create a funded escrow ledger balance. Until a dedicated
  // cash settlement/commission-receivable flow exists, fail closed rather than
  // manufacture wallet money from an unfunded escrow account.
  if (escrow.paymentMethod === 'CASH' || options?.cashConfirmed) {
    throw new Error('CASH_PAYMENT_DISABLED')
  }

  const quote = await prisma.jobQuote.findUnique({
    where: { id: escrow.quoteId },
    select: { providerId: true, providerType: true },
  })
  if (!quote) throw new Error('Accepted quote not found')
  if (quote.providerId !== escrow.providerId) throw new Error('Escrow provider identity mismatch')
  if (quote.providerType !== 'INDIVIDUAL' && quote.providerType !== 'COMPANY') {
    throw new Error('Accepted quote provider type is invalid')
  }
  const providerType = quote.providerType
  const escrowCurrency = escrow.currency as Currency

  const identity = await resolvePayoutIdentity(quote.providerId, providerType)
  const defaultRate = await getCommissionRate()
  const rawRate = identity.commissionRate ?? defaultRate
  const rate = Math.max(0, Math.min(100, rawRate))
  const rateBps = BigInt(Math.round(rate * 100))
  const commissionCents = (escrow.amount * rateBps) / 10000n
  const netCents = escrow.amount - commissionCents
  const platformCents = commissionCents + escrow.serviceFee
  const commissionMajor = bigIntToSafeNumber(commissionCents) / 100
  const netMajor = bigIntToSafeNumber(netCents) / 100
  let providerPayoutCents = netCents
  let providerPayoutMajor = netMajor

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.jobEscrow.updateMany({
      where: { id: escrow.id, status: { in: allowedStatuses }, paymentMethod: { not: 'CASH' } },
      data: { status: 'RELEASED', releasedAt: new Date() },
    })
    if (claimed.count !== 1) throw new Error('Escrow already released or state changed')

    const commissionRecovery = await recoverProviderCommissionFromOnlineEarnings(tx, {
      providerId: quote.providerId,
      providerType,
      countryCode: job.countryCode || 'LK',
      currency: escrowCurrency,
      availableOnlineEarningsMinor: netCents,
      sourceJobId: jobId,
      sourceEscrowId: escrow.id,
      createdBy: ctx.actorId,
    })
    providerPayoutCents = commissionRecovery.providerPayoutMinor
    providerPayoutMajor = bigIntToSafeNumber(providerPayoutCents) / 100

    const providerWalletSeed = await tx.providerWallet.upsert({
      where: { userId: identity.payoutUserId },
      create: { userId: identity.payoutUserId, availableBalance: 0 },
      update: {},
      select: { id: true },
    })

    const ledgerEntries: Array<{
      accountId: string
      accountType: string
      entryType: 'CREDIT' | 'DEBIT'
      amount: bigint
    }> = [
      { accountId: `escrow:${escrow.id}`, accountType: 'ESCROW', entryType: 'DEBIT', amount: escrow.totalAmount },
    ]
    if (providerPayoutCents > 0n) {
      ledgerEntries.push({
        accountId: providerWalletSeed.id,
        accountType: 'PROVIDER_WALLET',
        entryType: 'CREDIT',
        amount: providerPayoutCents,
      })
    }
    if (commissionRecovery.recoveryMinor > 0n) {
      ledgerEntries.push({
        accountId: `provider-receivable:${commissionRecovery.providerIdentityId}`,
        accountType: 'PROVIDER_COMMISSION_RECEIVABLE',
        entryType: 'CREDIT',
        amount: commissionRecovery.recoveryMinor,
      })
    }
    if (platformCents > 0n) {
      ledgerEntries.push({ accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: platformCents })
    }

    await postLedgerTransaction({
      entries: ledgerEntries,
      currency: escrow.currency as Currency,
      referenceType: 'ESCROW_RELEASE',
      referenceId: escrow.id,
      idempotencyKey: `escrow-release:${escrow.id}`,
      description: `Escrow release for job ${jobId}`,
      createdBy: ctx.actorId,
      metadata: JSON.stringify({
        providerEntityId: identity.providerEntityId,
        payoutUserId: identity.payoutUserId,
        providerType: quote.providerType,
        serviceFeeCents: escrow.serviceFee.toString(),
        commissionCents: commissionCents.toString(),
        cashCommissionRecoveryCents: commissionRecovery.recoveryMinor.toString(),
        remainingCashCommissionDueCents: commissionRecovery.remainingCommissionDueMinor.toString(),
        providerPayoutCents: providerPayoutCents.toString(),
        recoveryAllocations: commissionRecovery.allocations.map(allocation => ({
          receivableId: allocation.receivableId,
          amount: allocation.amount.toString(),
        })),
      }),
    }, tx)

    if (escrowCurrency === 'LKR' && providerPayoutCents > 0n) {
      const providerWallet = await tx.providerWallet.update({
        where: { userId: identity.payoutUserId },
        data: { availableBalance: { increment: providerPayoutMajor } },
        select: { availableBalance: true },
      })

      await tx.walletTransaction.create({
        data: {
          userId: identity.payoutUserId,
          walletType: 'PROVIDER',
          type: 'CREDIT',
          amount: providerPayoutMajor,
          balanceBefore: providerWallet.availableBalance - providerPayoutMajor,
          balanceAfter: providerWallet.availableBalance,
          reference: commissionRecovery.recoveryMinor > 0n
            ? `Escrow release for job ${jobId}; prior cash commission automatically recovered`
            : commissionCents > 0n
              ? `Escrow release for job ${jobId} (${rate}% commission: LKR ${commissionMajor})`
              : `Escrow release for job ${jobId}`,
          referenceType: 'ESCROW_RELEASE',
          referenceId: escrow.id,
          currency: escrowCurrency,
        },
      })
    }

    if (isStaff) {
      await tx.marketplaceJob.updateMany({
        where: { id: jobId, status: { not: 'COMPLETED' } },
        data: { status: 'COMPLETED' },
      })
      await tx.jobWorkspace.updateMany({
        where: { jobId, progressStatus: { not: 'COMPLETED' } },
        data: { progressStatus: 'COMPLETED' },
      })
    } else {
      await tx.marketplaceJob.updateMany({
        where: { id: jobId, status: 'IN_PROGRESS' },
        data: { status: 'COMPLETED' },
      })
    }

    if (commissionCents > 0n) {
      await tx.commissionSettlement.create({
        data: {
          jobId,
          escrowId: escrow.id,
          providerId: identity.payoutUserId,
          customerId: escrow.customerId,
          jobAmount: escrow.amount,
          commissionRate: rate,
          commissionAmount: commissionCents,
          currency: escrowCurrency,
          countryCode: job.countryCode || 'LK',
          status: 'PENDING',
        },
      })
    }

  })

  return {
    commission: commissionMajor,
    netAmount: providerPayoutMajor,
    commissionCents,
    netCents: providerPayoutCents,
    providerId: identity.payoutUserId,
    providerEntityId: identity.providerEntityId,
    providerType: quote.providerType,
  }
}

export async function refundEscrow(ctx: TransitionContext, jobId: string) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Job not found')

  const isCustomer = job.customerId === ctx.actorId
  const isStaff = ctx.actorType === 'STAFF'
  let isAcceptedProvider = false

  if (!isCustomer && !isStaff && job.status === 'QUOTE_ACCEPTED') {
    const resolvedActor = await resolveProviderActor(jobId, ctx.actorId)
    isAcceptedProvider =
      resolvedActor !== null &&
      resolvedActor === ctx.actorType &&
      (resolvedActor === 'PROVIDER' || resolvedActor === 'COMPANY')
  }

  if (!isCustomer && !isStaff && !isAcceptedProvider) {
    throw new Error('Only the customer, accepted provider, or staff can refund escrow before work starts')
  }
  if (job.status === 'IN_PROGRESS' && !isStaff) {
    throw new Error('ACTIVE_JOB_REQUIRES_DISPUTE')
  }

  const escrow = await prisma.jobEscrow.findFirst({
    where: { jobId, status: { in: ['PROTECTED', 'PENDING_PAYMENT', 'ON_HOLD', 'CASH_CONFIRMED'] } },
  })
  if (!escrow) throw new Error('No refundable escrow found')

  const closeBooking = async (
    tx: Prisma.TransactionClient,
    lifecycleAction: string,
    lifecycleMetadata: Record<string, unknown>
  ) => {
    await tx.marketplaceJob.updateMany({
      where: { id: jobId, status: { not: 'COMPLETED' } },
      data: { status: 'CANCELLED', isActive: false, responseState: 'resolved' },
    })
    await tx.jobQuote.updateMany({
      where: { id: escrow.quoteId, status: 'ACCEPTED' },
      data: { status: 'WITHDRAWN' },
    })
    await tx.companyJobAssignment.updateMany({
      where: { jobId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedReason: ctx.reason ?? 'Booking cancelled/refunded',
      },
    })
    await recordJobLifecycleEvent(tx, {
      jobId,
      actorId: ctx.actorId,
      actorType: ctx.actorType,
      action: lifecycleAction,
      fromState: job.status,
      toState: 'CANCELLED',
      metadata: {
        reason: ctx.reason ?? null,
        escrowId: escrow.id,
        ...lifecycleMetadata,
      },
    })
  }

  if (escrow.status === 'PENDING_PAYMENT') {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.jobEscrow.updateMany({
        where: { id: escrow.id, status: 'PENDING_PAYMENT' },
        data: { status: 'CANCELLED' },
      })
      if (claimed.count !== 1) throw new Error('Escrow state changed concurrently')

      await tx.paymentIntent.updateMany({
        where: { jobId, status: { in: ['CREATED', 'PENDING'] } },
        data: { status: 'CANCELLED' },
      })

      await closeBooking(tx, 'JOB_CANCELLED', {
        escrowFromState: 'PENDING_PAYMENT',
        escrowToState: 'CANCELLED',
        refundMinor: 0,
      })
    })

    return {
      refundAmount: 0,
      refundCents: 0n,
      refundPendingExternal: false,
      fundingSource: 'NONE' as const,
    }
  }

  if (
    escrow.paymentMethod === 'CASH' &&
    ['CASH_CONFIRMED', 'ON_HOLD'].includes(escrow.status)
  ) {
    const cashResolutionStatus = escrow.status === 'ON_HOLD' ? 'REFUNDED' : 'CANCELLED'

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.jobEscrow.updateMany({
        where: {
          id: escrow.id,
          paymentMethod: 'CASH',
          status: escrow.status,
        },
        data: {
          status: cashResolutionStatus,
          ...(cashResolutionStatus === 'REFUNDED' ? { refundedAt: new Date() } : {}),
        },
      })
      if (claimed.count !== 1) throw new Error('Cash payment state changed concurrently')

      await tx.paymentIntent.updateMany({
        where: { jobId, status: { in: ['CREATED', 'PENDING'] } },
        data: { status: 'CANCELLED' },
      })

      await closeBooking(
        tx,
        escrow.status === 'ON_HOLD' ? 'CASH_DISPUTE_REFUND_RESOLVED' : 'CASH_BOOKING_CANCELLED',
        {
          escrowFromState: escrow.status,
          escrowToState: cashResolutionStatus,
          refundMinor: 0,
          cashNoPlatformFunds: true,
        },
      )
    })

    return {
      refundAmount: 0,
      refundCents: 0n,
      refundPendingExternal: false,
      fundingSource: 'NONE' as const,
      cashCancelled: true,
    }
  }

  const refundCents = escrow.totalAmount
  const refundMajor = bigIntToSafeNumber(refundCents) / 100
  const fundingSource = await resolveEscrowFundingSource(prisma, escrow.id)

  if (fundingSource === 'PAYHERE') {
    const paymentIntent = await prisma.paymentIntent.findFirst({
      where: {
        escrowId: escrow.id,
        status: {
          in: ['SUCCESS', 'REFUND_REQUIRED', 'REFUND_PROCESSING', 'REFUNDED'],
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!paymentIntent || !paymentIntent.paymentId) {
      throw new Error('PAYHERE_REFUND_PAYMENT_NOT_FOUND')
    }

    if (paymentIntent.status === 'REFUNDED') {
      return {
        refundAmount: refundMajor,
        refundCents,
        refundPendingExternal: false,
        fundingSource,
        paymentIntentId: paymentIntent.id,
      }
    }

    if (
      paymentIntent.status === 'REFUND_REQUIRED' ||
      paymentIntent.status === 'REFUND_PROCESSING'
    ) {
      return {
        refundAmount: refundMajor,
        refundCents,
        refundPendingExternal: true,
        fundingSource,
        paymentIntentId: paymentIntent.id,
      }
    }

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.jobEscrow.updateMany({
        where: {
          id: escrow.id,
          status: { in: ['PROTECTED', 'ON_HOLD'] },
          paymentMethod: { not: 'CASH' },
        },
        data: { status: 'ON_HOLD' },
      })
      if (claimed.count !== 1) throw new Error('Escrow already refunded or state changed')

      await tx.paymentIntent.updateMany({
        where: {
          id: paymentIntent.id,
          status: 'SUCCESS',
        },
        data: { status: 'REFUND_REQUIRED' },
      })

      await closeBooking(tx, 'PAYMENT_REFUND_REQUIRED', {
        escrowFromState: escrow.status,
        escrowToState: 'ON_HOLD',
        paymentIntentId: paymentIntent.id,
        paymentId: paymentIntent.paymentId,
        refundMinor: refundCents,
        currency: escrow.currency,
        fundingSource,
      })
    })

    return {
      refundAmount: refundMajor,
      refundCents,
      refundPendingExternal: true,
      fundingSource,
      paymentIntentId: paymentIntent.id,
    }
  }

  if (fundingSource !== 'WALLET') {
    throw new Error('REFUND_FUNDING_SOURCE_UNKNOWN')
  }

  const customerWallet = await prisma.customerWallet.upsert({
    where: { userId: job.customerId },
    update: {},
    create: { userId: job.customerId },
  })

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.jobEscrow.updateMany({
      where: {
        id: escrow.id,
        status: { in: ['PROTECTED', 'ON_HOLD'] },
        paymentMethod: { not: 'CASH' },
      },
      data: { status: 'REFUNDED', refundedAt: new Date() },
    })
    if (claimed.count !== 1) throw new Error('Escrow already refunded or state changed')

    await postLedgerTransaction({
      entries: [
        { accountId: `escrow:${escrow.id}`, accountType: 'ESCROW', entryType: 'DEBIT', amount: refundCents },
        { accountId: customerWallet.id, accountType: 'CUSTOMER_WALLET', entryType: 'CREDIT', amount: refundCents },
      ],
      currency: escrow.currency as Currency,
      referenceType: 'ESCROW_REFUND',
      referenceId: escrow.id,
      idempotencyKey: `escrow-refund:${escrow.id}`,
      description: `Escrow wallet refund for job ${jobId}`,
      createdBy: ctx.actorId,
    }, tx)

    const escrowCurrency = escrow.currency as Currency
    if (escrowCurrency === 'LKR') {
      const legacyCustomerWallet = await tx.customerWallet.update({
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
          balanceBefore: legacyCustomerWallet.balance - refundMajor,
          balanceAfter: legacyCustomerWallet.balance,
          reference: `Escrow wallet refund for job ${jobId}`,
          referenceType: 'ESCROW_REFUND',
          referenceId: escrow.id,
          currency: escrow.currency,
        },
      })
    }

    await closeBooking(tx, 'ESCROW_REFUNDED', {
      escrowFromState: escrow.status,
      escrowToState: 'REFUNDED',
      refundMinor: refundCents,
      currency: escrow.currency,
      fundingSource,
    })
  })

  return {
    refundAmount: refundMajor,
    refundCents,
    refundPendingExternal: false,
    fundingSource,
  }
}

export async function expirePendingEscrow(
  escrowId: string,
  options?: { actorId?: string }
): Promise<{ jobId: string; reverted: boolean }> {
  const escrow = await prisma.jobEscrow.findUnique({ where: { id: escrowId } })
  if (!escrow) throw new Error('Escrow not found')
  if (escrow.status !== 'PENDING_PAYMENT') return { jobId: escrow.jobId, reverted: false }

  const actorId = options?.actorId ?? 'system'

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.jobEscrow.updateMany({
      where: { id: escrowId, status: 'PENDING_PAYMENT' },
      data: { status: 'CANCELLED' },
    })
    if (claimed.count !== 1) throw new Error('Escrow state changed concurrently')

    await tx.marketplaceJob.updateMany({
      where: { id: escrow.jobId, status: 'QUOTE_ACCEPTED' },
      data: { status: 'OPEN', isActive: true },
    })

    const acceptedQuote = await tx.jobQuote.findFirst({
      where: { jobId: escrow.jobId, status: 'ACCEPTED' },
    })
    if (acceptedQuote) {
      await tx.jobQuote.updateMany({
        where: { id: acceptedQuote.id, status: 'ACCEPTED' },
        data: { status: 'PENDING' },
      })
    }

    const workspace = await tx.jobWorkspace.findUnique({ where: { jobId: escrow.jobId } })
    if (workspace && workspace.progressStatus !== 'ACCEPTED') {
      await tx.jobWorkspace.updateMany({
        where: { jobId: escrow.jobId, progressStatus: workspace.progressStatus },
        data: { progressStatus: 'ACCEPTED' },
      })
    }
  })

  return { jobId: escrow.jobId, reverted: true }
}

export type ReleaseMode = 'CUSTOMER_APPROVAL' | 'AUTO_RELEASE' | 'ADMIN_RESOLUTION'

export async function completeAndReleaseEscrow(
  ctx: TransitionContext,
  jobId: string,
  options?: { releaseMode?: ReleaseMode; autoReleaseHours?: number }
): Promise<{
  commission: number
  netAmount: number
  commissionCents: bigint
  netCents: bigint
  platformDue: number
  platformDueCents: bigint
  providerId: string
  providerEntityId: string
  providerType: string
  paymentMethod: 'CASH' | 'FUNDED'
}> {
  const releaseMode = options?.releaseMode ?? 'CUSTOMER_APPROVAL'

  return prisma.$transaction(async (tx) => {
    const job = await tx.marketplaceJob.findUnique({ where: { id: jobId } })
    if (!job) throw new Error('Job not found')

    if (releaseMode === 'CUSTOMER_APPROVAL' && job.customerId !== ctx.actorId) {
      throw new Error('Only the customer can approve')
    }

    if (job.status !== 'IN_PROGRESS') {
      if (job.status === 'COMPLETED') {
        const releasedEscrow = await tx.jobEscrow.findFirst({ where: { jobId, status: 'RELEASED' } })
        if (releasedEscrow) {
          const quote = await tx.jobQuote.findUnique({
            where: { id: releasedEscrow.quoteId },
            select: { providerId: true, providerType: true },
          })
          if (!quote) throw new Error('Accepted quote not found')
          const identity = await resolvePayoutIdentity(quote.providerId, quote.providerType)

          if (releasedEscrow.paymentMethod === 'CASH') {
            const defaultRate = await getCommissionRate()
            const rate = Math.max(0, Math.min(100, identity.commissionRate ?? defaultRate))
            const commissionCents =
              (releasedEscrow.amount * BigInt(Math.round(rate * 100))) / 10000n
            const platformDueCents = commissionCents + releasedEscrow.serviceFee
            const netCents = releasedEscrow.amount - commissionCents
            return {
              commission: bigIntToSafeNumber(commissionCents) / 100,
              netAmount: bigIntToSafeNumber(netCents) / 100,
              commissionCents,
              netCents,
              platformDue: bigIntToSafeNumber(platformDueCents) / 100,
              platformDueCents,
              providerId: identity.payoutUserId,
              providerEntityId: identity.providerEntityId,
              providerType: quote.providerType,
              paymentMethod: 'CASH' as const,
            }
          }

          const releaseLedger = await tx.financialLedger.findFirst({
            where: { referenceType: 'ESCROW_RELEASE', referenceId: releasedEscrow.id },
          })
          const meta = releaseLedger?.metadata ? JSON.parse(releaseLedger.metadata as string) : {}
          const commissionCents = BigInt(meta.commissionCents ?? '0')
          const netBeforeRecoveryCents = releasedEscrow.amount - commissionCents
          const netCents = BigInt(meta.providerPayoutCents ?? netBeforeRecoveryCents.toString())
          const platformDueCents = commissionCents + releasedEscrow.serviceFee
          return {
            commission: bigIntToSafeNumber(commissionCents) / 100,
            netAmount: bigIntToSafeNumber(netCents) / 100,
            commissionCents,
            netCents,
            platformDue: bigIntToSafeNumber(platformDueCents) / 100,
            platformDueCents,
            providerId: meta.payoutUserId ?? identity.payoutUserId,
            providerEntityId: meta.providerEntityId ?? identity.providerEntityId,
            providerType: meta.providerType ?? quote.providerType,
            paymentMethod: 'FUNDED' as const,
          }
        }
      }
      throw new Error('Job is not in progress')
    }

    const workspace = await tx.jobWorkspace.findUnique({ where: { jobId } })
    if (!workspace) throw new Error('Workspace not found')

    if (releaseMode === 'AUTO_RELEASE') {
      if (workspace.progressStatus !== 'COMPLETION_REQUESTED') throw new Error('Job not awaiting completion')
      if (workspace.completionRequestedAt == null) throw new Error('No completion request timestamp')
      const autoReleaseHours = options?.autoReleaseHours ?? 48
      const hoursSinceRequest =
        (Date.now() - workspace.completionRequestedAt.getTime()) / (1000 * 60 * 60)
      if (hoursSinceRequest < autoReleaseHours) throw new Error('Auto-release deadline not reached')
    } else if (releaseMode === 'ADMIN_RESOLUTION') {
      if (
        workspace.progressStatus !== 'COMPLETION_REQUESTED' &&
        workspace.progressStatus !== 'DISPUTED'
      ) {
        throw new Error('Admin resolution requires COMPLETION_REQUESTED or DISPUTED workspace')
      }
    } else if (workspace.progressStatus !== 'COMPLETION_REQUESTED') {
      throw new Error('Provider must request completion first')
    }

    const allowedEscrowStatuses =
      releaseMode === 'AUTO_RELEASE'
        ? ['PROTECTED']
        : releaseMode === 'ADMIN_RESOLUTION'
          ? ['PROTECTED', 'ON_HOLD', 'CASH_CONFIRMED']
          : ['PROTECTED', 'CASH_CONFIRMED']

    const escrow = await tx.jobEscrow.findFirst({
      where: { jobId, status: { in: allowedEscrowStatuses as any } },
    })
    if (!escrow) throw new Error('No releasable escrow found')
    if (releaseMode === 'AUTO_RELEASE' && escrow.paymentMethod === 'CASH') {
      throw new Error('Cash jobs require explicit customer approval or admin resolution')
    }
    if (
      job.finalAuthorizedAmountCents != null &&
      job.finalAuthorizedAmountCents !== escrow.amount
    ) {
      throw new Error('ESCROW_AUTHORIZED_AMOUNT_MISMATCH')
    }

    const quote = await tx.jobQuote.findUnique({
      where: { id: escrow.quoteId },
      select: { providerId: true, providerType: true },
    })
    if (!quote) throw new Error('Accepted quote not found')
    if (quote.providerId !== escrow.providerId) throw new Error('Escrow provider identity mismatch')
    if (quote.providerType !== 'INDIVIDUAL' && quote.providerType !== 'COMPANY') {
      throw new Error('Accepted quote provider type is invalid')
    }
    const providerType = quote.providerType

    const identity = await resolvePayoutIdentity(quote.providerId, providerType)
    const defaultRate = await getCommissionRate()
    const rawRate = identity.commissionRate ?? defaultRate
    const rate = Math.max(0, Math.min(100, rawRate))
    const rateBps = BigInt(Math.round(rate * 100))
    const commissionCents = (escrow.amount * rateBps) / 10000n
    const netCents = escrow.amount - commissionCents
    const platformDueCents = commissionCents + escrow.serviceFee
    const commissionMajor = bigIntToSafeNumber(commissionCents) / 100
    const netMajor = bigIntToSafeNumber(netCents) / 100
    const platformDueMajor = bigIntToSafeNumber(platformDueCents) / 100
    const escrowCurrency = escrow.currency as Currency

    if (escrow.paymentMethod === 'CASH') {
      const cashAllowedStatuses =
        releaseMode === 'ADMIN_RESOLUTION'
          ? ['CASH_CONFIRMED', 'ON_HOLD']
          : ['CASH_CONFIRMED']
      const claimed = await tx.jobEscrow.updateMany({
        where: {
          id: escrow.id,
          paymentMethod: 'CASH',
          status: { in: cashAllowedStatuses as any },
        },
        data: { status: 'RELEASED', releasedAt: new Date() },
      })
      if (claimed.count !== 1) throw new Error('Cash settlement already completed or state changed')

      await tx.jobWorkspace.updateMany({
        where: { jobId, progressStatus: { not: 'COMPLETED' } },
        data: { progressStatus: 'COMPLETED', updatedAt: new Date() },
      })
      await tx.marketplaceJob.updateMany({
        where: { id: jobId, status: 'IN_PROGRESS' },
        data: { status: 'COMPLETED', updatedAt: new Date() },
      })
      if (quote.providerType === 'COMPANY') {
        await tx.companyJobAssignment.updateMany({
          where: { jobId, companyId: quote.providerId, status: 'IN_PROGRESS' },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })
      }

      const effectivePlatformRate =
        escrow.amount > 0n
          ? (bigIntToSafeNumber(platformDueCents) * 100) / bigIntToSafeNumber(escrow.amount)
          : 0

      if (platformDueCents > 0n) {
        const weeklySettlement = await recordWeeklySettlement(tx, {
          providerId: identity.payoutUserId,
          providerType: quote.providerType,
          jobAmountCents: escrow.amount,
          commissionRate: effectivePlatformRate,
          commissionCents: platformDueCents,
          currency: escrowCurrency,
          countryCode: job.countryCode || 'LK',
        })

        await recordCashPlatformReceivable(tx, {
          jobId,
          escrowId: escrow.id,
          providerId: quote.providerId,
          providerType,
          countryCode: job.countryCode || 'LK',
          currency: escrowCurrency,
          platformDueMinor: platformDueCents,
          weeklySettlementId: weeklySettlement.id,
          createdBy: ctx.actorId,
        })
      }

      await recordJobLifecycleEvent(tx, {
        jobId,
        actorId: ctx.actorId,
        actorType: ctx.actorType,
        action: 'JOB_COMPLETED',
        fromState: job.status,
        toState: 'COMPLETED',
        metadata: {
          releaseMode,
          paymentMethod: 'CASH',
          escrowId: escrow.id,
          workspaceFromState: workspace.progressStatus,
          workspaceToState: 'COMPLETED',
          cashCollectedMinor: escrow.totalAmount,
          providerCommissionMinor: commissionCents,
          serviceFeeMinor: escrow.serviceFee,
          platformDueMinor: platformDueCents,
          providerNetMinor: netCents,
          currency: escrowCurrency,
        },
      })

      return {
        commission: commissionMajor,
        netAmount: netMajor,
        commissionCents,
        netCents,
        platformDue: platformDueMajor,
        platformDueCents,
        providerId: identity.payoutUserId,
        providerEntityId: identity.providerEntityId,
        providerType: quote.providerType,
        paymentMethod: 'CASH' as const,
      }
    }

    const claimed = await tx.jobEscrow.updateMany({
      where: {
        id: escrow.id,
        status: { in: allowedEscrowStatuses as any },
        paymentMethod: { not: 'CASH' },
      },
      data: { status: 'RELEASED', releasedAt: new Date() },
    })
    if (claimed.count !== 1) throw new Error('Escrow already released or state changed')

    const commissionRecovery = await recoverProviderCommissionFromOnlineEarnings(tx, {
      providerId: quote.providerId,
      providerType,
      countryCode: job.countryCode || 'LK',
      currency: escrowCurrency,
      availableOnlineEarningsMinor: netCents,
      sourceJobId: jobId,
      sourceEscrowId: escrow.id,
      createdBy: ctx.actorId,
    })
    const providerPayoutCents = commissionRecovery.providerPayoutMinor
    const providerPayoutMajor = bigIntToSafeNumber(providerPayoutCents) / 100

    const providerWalletSeed = await tx.providerWallet.upsert({
      where: { userId: identity.payoutUserId },
      create: { userId: identity.payoutUserId, availableBalance: 0 },
      update: {},
      select: { id: true },
    })

    const ledgerEntries: Array<{
      accountId: string
      accountType: string
      entryType: 'CREDIT' | 'DEBIT'
      amount: bigint
    }> = [
      {
        accountId: `escrow:${escrow.id}`,
        accountType: 'ESCROW',
        entryType: 'DEBIT',
        amount: escrow.totalAmount,
      },
    ]
    if (providerPayoutCents > 0n) {
      ledgerEntries.push({
        accountId: providerWalletSeed.id,
        accountType: 'PROVIDER_WALLET',
        entryType: 'CREDIT',
        amount: providerPayoutCents,
      })
    }
    if (commissionRecovery.recoveryMinor > 0n) {
      ledgerEntries.push({
        accountId: `provider-receivable:${commissionRecovery.providerIdentityId}`,
        accountType: 'PROVIDER_COMMISSION_RECEIVABLE',
        entryType: 'CREDIT',
        amount: commissionRecovery.recoveryMinor,
      })
    }
    if (platformDueCents > 0n) {
      ledgerEntries.push({
        accountId: 'platform',
        accountType: 'PLATFORM',
        entryType: 'CREDIT',
        amount: platformDueCents,
      })
    }

    await postLedgerTransaction({
      entries: ledgerEntries,
      currency: escrowCurrency,
      referenceType: 'ESCROW_RELEASE',
      referenceId: escrow.id,
      idempotencyKey: `escrow-release:${escrow.id}`,
      description: `Escrow release for job ${jobId} (mode: ${releaseMode})`,
      createdBy: ctx.actorId,
      metadata: JSON.stringify({
        providerEntityId: identity.providerEntityId,
        payoutUserId: identity.payoutUserId,
        providerType: quote.providerType,
        serviceFeeCents: escrow.serviceFee.toString(),
        commissionCents: commissionCents.toString(),
        cashCommissionRecoveryCents: commissionRecovery.recoveryMinor.toString(),
        remainingCashCommissionDueCents: commissionRecovery.remainingCommissionDueMinor.toString(),
        providerPayoutCents: providerPayoutCents.toString(),
        recoveryAllocations: commissionRecovery.allocations.map(allocation => ({
          receivableId: allocation.receivableId,
          amount: allocation.amount.toString(),
        })),
        releaseMode,
      }),
    }, tx)

    if (escrowCurrency === 'LKR' && providerPayoutCents > 0n) {
      const providerWallet = await tx.providerWallet.update({
        where: { userId: identity.payoutUserId },
        data: { availableBalance: { increment: providerPayoutMajor } },
        select: { availableBalance: true },
      })

      await tx.walletTransaction.create({
        data: {
          userId: identity.payoutUserId,
          walletType: 'PROVIDER',
          type: 'CREDIT',
          amount: providerPayoutMajor,
          balanceBefore: providerWallet.availableBalance - providerPayoutMajor,
          balanceAfter: providerWallet.availableBalance,
          reference:
            commissionRecovery.recoveryMinor > 0n
              ? `Escrow release for job ${jobId}; prior cash commission automatically recovered`
              : commissionCents > 0n
                ? `Escrow release for job ${jobId} (${rate}% commission: LKR ${commissionMajor})`
                : `Escrow release for job ${jobId}`,
          referenceType: 'ESCROW_RELEASE',
          referenceId: escrow.id,
          currency: escrowCurrency,
        },
      })
    }

    await tx.jobWorkspace.updateMany({
      where: { jobId, progressStatus: { not: 'COMPLETED' } },
      data: { progressStatus: 'COMPLETED', updatedAt: new Date() },
    })
    await tx.marketplaceJob.updateMany({
      where: { id: jobId, status: 'IN_PROGRESS' },
      data: { status: 'COMPLETED', updatedAt: new Date() },
    })
    if (quote.providerType === 'COMPANY') {
      await tx.companyJobAssignment.updateMany({
        where: { jobId, companyId: quote.providerId, status: 'IN_PROGRESS' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
    }

    if (commissionCents > 0n) {
      await tx.commissionSettlement.create({
        data: {
          jobId,
          escrowId: escrow.id,
          providerId: identity.payoutUserId,
          customerId: escrow.customerId,
          jobAmount: escrow.amount,
          commissionRate: rate,
          commissionAmount: commissionCents,
          currency: escrowCurrency,
          countryCode: job.countryCode || 'LK',
          status: 'PENDING',
        },
      })
    }

    await recordJobLifecycleEvent(tx, {
      jobId,
      actorId: ctx.actorId,
      actorType: ctx.actorType,
      action: 'JOB_COMPLETED',
      fromState: job.status,
      toState: 'COMPLETED',
      metadata: {
        releaseMode,
        paymentMethod: 'FUNDED',
        escrowId: escrow.id,
        workspaceFromState: workspace.progressStatus,
        workspaceToState: 'COMPLETED',
        commissionMinor: commissionCents,
        providerNetBeforeRecoveryMinor: netCents,
        cashCommissionRecoveryMinor: commissionRecovery.recoveryMinor,
        providerNetMinor: providerPayoutCents,
        remainingCashCommissionDueMinor: commissionRecovery.remainingCommissionDueMinor,
        serviceFeeMinor: escrow.serviceFee,
        platformCollectedMinor: platformDueCents,
        currency: escrowCurrency,
      },
    })

    return {
      commission: commissionMajor,
      netAmount: providerPayoutMajor,
      commissionCents,
      netCents: providerPayoutCents,
      platformDue: platformDueMajor,
      platformDueCents,
      providerId: identity.payoutUserId,
      providerEntityId: identity.providerEntityId,
      providerType: quote.providerType,
      paymentMethod: 'FUNDED' as const,
    }
  })
}
