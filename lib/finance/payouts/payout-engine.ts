import { prisma } from '@/lib/prisma'
import { postLedgerTransaction } from '@/lib/finance/ledger/ledger-service'
import { bigIntToSafeNumber, type Currency, getCurrencyForCountry } from '@/lib/shared/money/money'
import { isPayoutExecutionFrozen } from '@/lib/crm/emergency-controls'

export type PayoutStatus =
  | 'REQUESTED'
  | 'RESERVED'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REVERSED'
  | 'CANCELLED'

export const VALID_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  REQUESTED: ['RESERVED', 'CANCELLED', 'FAILED'],
  RESERVED: ['PROCESSING', 'CANCELLED', 'FAILED'],
  PROCESSING: ['SUCCEEDED', 'FAILED', 'CANCELLED'],
  SUCCEEDED: [],
  FAILED: [],
  REVERSED: [],
  CANCELLED: [],
}

export function isValidTransition(from: PayoutStatus, to: PayoutStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export type PayoutResult =
  | { ok: true; payoutId: string; status: PayoutStatus }
  | { ok: false; error: string; code: string }

function isUniqueConstraintViolation(error: any): boolean {
  return error?.code === 'P2002' ||
    error?.meta?.code === '23505' ||
    error?.message?.includes('duplicate key') ||
    error?.message?.includes('unique constraint')
}

function safeMajorAmount(amountCents: bigint): number {
  return bigIntToSafeNumber(amountCents) / 100
}

async function assertPayoutNotFrozenInTransaction(
  tx: any,
  market: string,
  now = new Date()
): Promise<void> {
  const normalizedMarket = /^[A-Z]{2}$/.test(market.toUpperCase())
    ? market.toUpperCase()
    : 'GLOBAL'

  const frozen = await tx.crmEmergencyControl.findFirst({
    where: {
      controlKey: 'PAYOUTS_FROZEN',
      active: true,
      market: {
        in: normalizedMarket === 'GLOBAL'
          ? ['GLOBAL']
          : ['GLOBAL', normalizedMarket],
      },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    select: { id: true },
  })

  if (frozen) throw new Error('PAYOUTS_FROZEN')
}

async function readCompletedIdempotency(idempotencyKey: string): Promise<{ payoutId: string; status: PayoutStatus; payloadHash?: string } | null> {
  const existing = await prisma.idempotencyRecord.findUnique({ where: { idempotencyKey } })
  if (!existing?.metadata || existing.status !== 'COMPLETED') return null
  try {
    const parsed = JSON.parse(existing.metadata)
    if (!parsed.payoutId || !parsed.status) return null
    return {
      payoutId: String(parsed.payoutId),
      status: parsed.status as PayoutStatus,
      payloadHash: typeof parsed.payloadHash === 'string' ? parsed.payloadHash : undefined,
    }
  } catch {
    return null
  }
}

export async function requestPayout(
  userId: string,
  amountCents: bigint,
  method: string,
  bankDetails: string | null,
  idempotencyKey: string,
  createdBy: string,
  currency: Currency = 'LKR'
): Promise<PayoutResult> {
  const minPayoutCents = currency === 'CAD' ? 5000n : 50000n
  if (amountCents <= 0n) {
    return { ok: false, error: 'Withdrawal amount must be positive', code: 'INVALID_AMOUNT' }
  }
  if (amountCents < minPayoutCents) {
    const minLabel = currency === 'CAD' ? 'CAD 50' : 'LKR 500'
    return { ok: false, error: `Minimum withdrawal is ${minLabel}`, code: 'BELOW_MINIMUM' }
  }

  try {
    safeMajorAmount(amountCents)
  } catch {
    return { ok: false, error: 'Withdrawal amount is outside the supported safe range', code: 'INVALID_AMOUNT' }
  }

  const payloadHash = `${userId}:${amountCents.toString()}:${method}:${currency}`
  const existing = await readCompletedIdempotency(idempotencyKey)
  if (existing) {
    if (existing.payloadHash === payloadHash) {
      return { ok: true, payoutId: existing.payoutId, status: existing.status }
    }
    return { ok: false, error: 'Idempotency key conflict', code: 'IDEMPOTENCY_CONFLICT' }
  }

  const wallet = await prisma.providerWallet.findUnique({ where: { userId } })
  if (!wallet) return { ok: false, error: 'Provider wallet not found', code: 'WALLET_NOT_FOUND' }
  if (wallet.isFrozen) return { ok: false, error: 'Wallet is frozen', code: 'WALLET_FROZEN' }

  const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { countryCode: true } })
  const payoutCountry = userRecord?.countryCode || (currency === 'CAD' ? 'CA' : 'LK')

  if (await isPayoutExecutionFrozen(payoutCountry)) {
    return {
      ok: false,
      error: 'Payout execution is temporarily frozen',
      code: 'PAYOUTS_FROZEN',
    }
  }

  try {
    const payout = await prisma.$transaction(async (tx) => {
      await assertPayoutNotFrozenInTransaction(tx, payoutCountry)
      // PAYOUT_REQUEST_TRANSACTION_FREEZE_CHECK
      const locked = await tx.$queryRawUnsafe<Array<{ available: number }>>(
        `SELECT "availableBalance" as available
         FROM "WalletBalance"
         WHERE "walletId" = $1 AND "walletType" = 'PROVIDER' AND "currency" = $2
         FOR UPDATE`,
        wallet.id, currency,
      )
      if (locked.length === 0) throw new Error('BALANCE_NOT_FOUND')

      const availableCents = BigInt(locked[0].available)
      if (availableCents < amountCents) throw new Error('INSUFFICIENT_FUNDS')

      // Re-check idempotency after acquiring the wallet lock. A concurrent
      // request may have completed while this transaction was waiting.
      const raced = await tx.idempotencyRecord.findUnique({ where: { idempotencyKey } })
      if (raced) throw new Error('IDEMPOTENCY_RACE')

      const created = await tx.payout.create({
        data: {
          userId,
          amount: amountCents,
          status: 'RESERVED',
          source: 'WITHDRAWAL',
          method,
          bankDetails,
          currency,
          countryCode: payoutCountry,
          description: `Withdrawal request for ${safeMajorAmount(amountCents).toFixed(2)} ${currency}`,
        },
      })

      await postLedgerTransaction({
        entries: [
          { accountId: wallet.id, accountType: 'PROVIDER_WALLET', entryType: 'DEBIT', amount: amountCents },
          { accountId: `payout:${created.id}`, accountType: 'PAYOUT_CLEARING', entryType: 'CREDIT', amount: amountCents },
        ],
        currency,
        referenceType: 'WITHDRAWAL_RESERVED',
        referenceId: created.id,
        idempotencyKey: `payout-reserve:${idempotencyKey}`,
        description: `Withdrawal reservation for payout ${created.id}`,
        createdBy,
      }, tx)

      await tx.idempotencyRecord.create({
        data: {
          idempotencyKey,
          operation: 'PAYOUT_REQUEST',
          status: 'COMPLETED',
          metadata: JSON.stringify({ payoutId: created.id, status: 'RESERVED', payloadHash }),
          requestFingerprint: payloadHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })

      return created
    })

    return { ok: true, payoutId: payout.id, status: 'RESERVED' }
  } catch (error: any) {
    if (error?.message === 'INSUFFICIENT_FUNDS') {
      return { ok: false, error: 'Insufficient funds', code: 'INSUFFICIENT_FUNDS' }
    }
    if (error?.message === 'BALANCE_NOT_FOUND') {
      return { ok: false, error: 'Canonical balance not found', code: 'BALANCE_NOT_FOUND' }
    }
    if (error?.message === 'PAYOUTS_FROZEN') {
      return { ok: false, error: 'Payout execution is temporarily frozen', code: 'PAYOUTS_FROZEN' }
    }
    if (error?.message === 'IDEMPOTENCY_RACE' || isUniqueConstraintViolation(error)) {
      const raced = await readCompletedIdempotency(idempotencyKey)
      if (raced?.payloadHash === payloadHash) {
        return { ok: true, payoutId: raced.payoutId, status: raced.status }
      }
      return { ok: false, error: 'Idempotency key conflict', code: 'IDEMPOTENCY_CONFLICT' }
    }
    throw error
  }
}

async function transitionPayout(
  payoutId: string,
  targetStatus: PayoutStatus,
  idempotencyKey: string,
  operation: string,
  extra: Record<string, unknown> = {}
): Promise<{ payout: { id: string; userId: string; amount: bigint; status: string }; changed: boolean }> {
  const existing = await readCompletedIdempotency(idempotencyKey)
  if (existing) {
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      select: { id: true, userId: true, amount: true, status: true },
    })
    if (!payout) throw new Error('NOT_FOUND')
    return { payout, changed: false }
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{
      id: string
      userId: string
      amount: string
      status: string
      currency: string
      countryCode: string
    }>>(
      `SELECT id, "userId", amount::text, status, currency, "countryCode"
       FROM "Payout"
       WHERE id = $1
       FOR UPDATE`,
      payoutId,
    )

    if (rows.length === 0) throw new Error('NOT_FOUND')
    const row = rows[0]

    if (row.status === targetStatus) {
      return {
        payout: {
          id: row.id,
          userId: row.userId,
          amount: BigInt(row.amount),
          status: row.status,
        },
        changed: false,
      }
    }

    // Break-glass freezes block progression toward external money movement,
    // but FAILED/CANCELLED paths remain available to restore reserved funds.
    if (targetStatus === 'PROCESSING') {
      await assertPayoutNotFrozenInTransaction(tx, row.countryCode)
    }

    if (!isValidTransition(row.status as PayoutStatus, targetStatus)) {
      throw new Error(`INVALID_TRANSITION:${row.status}->${targetStatus}`)
    }

    await tx.payout.update({
      where: { id: payoutId },
      data: { status: targetStatus, ...extra },
    })

    await tx.idempotencyRecord.create({
      data: {
        idempotencyKey,
        operation,
        status: 'COMPLETED',
        metadata: JSON.stringify({ payoutId, status: targetStatus }),
        requestFingerprint: `${operation}:${payoutId}:${targetStatus}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })

    return {
      payout: {
        id: row.id,
        userId: row.userId,
        amount: BigInt(row.amount),
        status: targetStatus,
      },
      changed: true,
    }
  })
}

export async function markProcessing(
  payoutId: string,
  actorId: string,
  idempotencyKey: string
): Promise<PayoutResult> {
  const completed = await readCompletedIdempotency(idempotencyKey)
  if (completed) return { ok: true, payoutId, status: completed.status }

  const payoutMeta = await prisma.payout.findUnique({
    where: { id: payoutId },
    select: { countryCode: true },
  })
  if (!payoutMeta) return { ok: false, error: 'Payout not found', code: 'NOT_FOUND' }
  if (await isPayoutExecutionFrozen(payoutMeta.countryCode)) {
    return {
      ok: false,
      error: 'Payout execution is temporarily frozen',
      code: 'PAYOUTS_FROZEN',
    }
  }

  // PAYOUT_PROCESSING_FROZEN_CHECK
  try {
    const { payout } = await transitionPayout(
      payoutId,
      'PROCESSING',
      idempotencyKey,
      'PAYOUT_PROCESSING',
      { processedBy: actorId },
    )
    return { ok: true, payoutId, status: payout.status as PayoutStatus }
  } catch (error: any) {
    if (error?.message === 'NOT_FOUND') return { ok: false, error: 'Payout not found', code: 'NOT_FOUND' }
    if (error?.message === 'PAYOUTS_FROZEN') {
      return { ok: false, error: 'Payout execution is temporarily frozen', code: 'PAYOUTS_FROZEN' }
    }
    if (error?.message?.startsWith('INVALID_TRANSITION')) {
      return { ok: false, error: error.message, code: 'INVALID_TRANSITION' }
    }
    throw error
  }
}

export async function markSucceeded(
  payoutId: string,
  providerRef: string | null,
  idempotencyKey: string,
  createdBy: string
): Promise<PayoutResult> {
  const existing = await readCompletedIdempotency(idempotencyKey)
  if (existing) return { ok: true, payoutId, status: existing.status }

  const payoutMeta = await prisma.payout.findUnique({
    where: { id: payoutId },
    select: { countryCode: true },
  })
  if (!payoutMeta) return { ok: false, error: 'Payout not found', code: 'NOT_FOUND' }
  if (await isPayoutExecutionFrozen(payoutMeta.countryCode)) {
    return {
      ok: false,
      error: 'Payout execution is temporarily frozen',
      code: 'PAYOUTS_FROZEN',
    }
  }

  // PAYOUT_SUCCESS_FROZEN_CHECK
  try {
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{ id: string; userId: string; amount: string; status: string; currency: string; countryCode: string }>>(
        `SELECT id, "userId", amount::text, status, currency, "countryCode" FROM "Payout" WHERE id = $1 FOR UPDATE`,
        payoutId,
      )
      if (rows.length === 0) throw new Error('NOT_FOUND')
      const payout = rows[0]
      if (payout.status === 'SUCCEEDED') return

      await assertPayoutNotFrozenInTransaction(tx, payout.countryCode)
      // PAYOUT_SUCCESS_TRANSACTION_FREEZE_CHECK
      if (!isValidTransition(payout.status as PayoutStatus, 'SUCCEEDED')) {
        throw new Error(`INVALID_TRANSITION:${payout.status}->SUCCEEDED`)
      }

      const amount = BigInt(payout.amount)
      await tx.payout.update({
        where: { id: payoutId },
        data: { status: 'SUCCEEDED', clearedAt: new Date() },
      })

      // Clear the reserved payout liability to an explicit external account.
      // This removes the old platform-credit residue on successful payouts.
      await postLedgerTransaction({
        entries: [
          { accountId: `payout:${payout.id}`, accountType: 'PAYOUT_CLEARING', entryType: 'DEBIT', amount },
          { accountId: `external:payout:${payout.id}`, accountType: 'EXTERNAL_PAYOUT', entryType: 'CREDIT', amount },
        ],
        currency: payout.currency as Currency,
        referenceType: 'PAYOUT_SUCCEEDED',
        referenceId: payout.id,
        idempotencyKey: `payout-success:${idempotencyKey}`,
        description: `Payout ${payoutId} completed${providerRef ? ` (ref: ${providerRef})` : ''}`,
        createdBy,
      }, tx)

      await tx.idempotencyRecord.create({
        data: {
          idempotencyKey,
          operation: 'PAYOUT_SUCCEEDED',
          status: 'COMPLETED',
          metadata: JSON.stringify({ payoutId, status: 'SUCCEEDED', providerRef }),
          requestFingerprint: `PAYOUT_SUCCEEDED:${payoutId}:${providerRef || ''}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })
    })

    return { ok: true, payoutId, status: 'SUCCEEDED' }
  } catch (error: any) {
    if (error?.message === 'NOT_FOUND') return { ok: false, error: 'Payout not found', code: 'NOT_FOUND' }
    if (error?.message === 'PAYOUTS_FROZEN') {
      return { ok: false, error: 'Payout execution is temporarily frozen', code: 'PAYOUTS_FROZEN' }
    }
    if (error?.message?.startsWith('INVALID_TRANSITION')) {
      return { ok: false, error: error.message, code: 'INVALID_TRANSITION' }
    }
    throw error
  }
}

async function restoreReservedPayout(
  payoutId: string,
  targetStatus: 'FAILED' | 'CANCELLED',
  reason: string,
  idempotencyKey: string,
  createdBy: string
): Promise<PayoutResult> {
  const existing = await readCompletedIdempotency(idempotencyKey)
  if (existing) return { ok: true, payoutId, status: existing.status }

  try {
    const finalStatus = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{ id: string; userId: string; amount: string; status: string; currency: string }>>(
        `SELECT id, "userId", amount::text, status, currency FROM "Payout" WHERE id = $1 FOR UPDATE`,
        payoutId,
      )
      if (rows.length === 0) throw new Error('NOT_FOUND')
      const payout = rows[0]

      if (payout.status === targetStatus) return targetStatus
      if (['SUCCEEDED', 'FAILED', 'REVERSED', 'CANCELLED'].includes(payout.status)) {
        return payout.status as PayoutStatus
      }
      if (!isValidTransition(payout.status as PayoutStatus, targetStatus)) {
        throw new Error(`INVALID_TRANSITION:${payout.status}->${targetStatus}`)
      }

      const needsRestore = payout.status === 'RESERVED' || payout.status === 'PROCESSING'
      await tx.payout.update({
        where: { id: payoutId },
        data: { status: targetStatus, rejectedReason: reason },
      })

      if (needsRestore) {
        const wallet = await tx.providerWallet.findUnique({
          where: { userId: payout.userId },
          select: { id: true },
        })
        if (!wallet) throw new Error('WALLET_NOT_FOUND')
        const amount = BigInt(payout.amount)

        await postLedgerTransaction({
          entries: [
            { accountId: `payout:${payout.id}`, accountType: 'PAYOUT_CLEARING', entryType: 'DEBIT', amount },
            { accountId: wallet.id, accountType: 'PROVIDER_WALLET', entryType: 'CREDIT', amount },
          ],
          currency: payout.currency as Currency,
          referenceType: 'WITHDRAWAL_RELEASED',
          referenceId: payout.id,
          idempotencyKey: `payout-restore:${idempotencyKey}`,
          description: `Payout ${payoutId} ${targetStatus.toLowerCase()}: ${reason} — funds restored`,
          createdBy,
        }, tx)
      }

      await tx.idempotencyRecord.create({
        data: {
          idempotencyKey,
          operation: targetStatus === 'FAILED' ? 'PAYOUT_FAILED' : 'PAYOUT_CANCEL',
          status: 'COMPLETED',
          metadata: JSON.stringify({ payoutId, status: targetStatus }),
          requestFingerprint: `${targetStatus === 'FAILED' ? 'PAYOUT_FAILED' : 'PAYOUT_CANCEL'}:${payoutId}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })

      return targetStatus
    })

    return { ok: true, payoutId, status: finalStatus }
  } catch (error: any) {
    if (error?.message === 'NOT_FOUND') return { ok: false, error: 'Payout not found', code: 'NOT_FOUND' }
    if (error?.message === 'WALLET_NOT_FOUND') return { ok: false, error: 'Provider wallet not found', code: 'WALLET_NOT_FOUND' }
    if (error?.message?.startsWith('INVALID_TRANSITION')) {
      return { ok: false, error: error.message, code: 'INVALID_TRANSITION' }
    }
    throw error
  }
}

export async function markFailed(
  payoutId: string,
  reason: string,
  idempotencyKey: string,
  createdBy: string
): Promise<PayoutResult> {
  return restoreReservedPayout(payoutId, 'FAILED', reason, idempotencyKey, createdBy)
}

export async function cancelPayout(
  payoutId: string,
  reason: string,
  idempotencyKey: string,
  createdBy: string
): Promise<PayoutResult> {
  return restoreReservedPayout(payoutId, 'CANCELLED', reason, idempotencyKey, createdBy)
}

export function isTestAccount(accountId: string): boolean {
  return accountId.startsWith('test-') ||
    accountId.startsWith('concurrent-') ||
    accountId.startsWith('balanced-') ||
    accountId.startsWith('immutable-') ||
    accountId.startsWith('wb-test') ||
    accountId.startsWith('wallet-underflow') ||
    accountId.startsWith('customer:test') ||
    accountId.startsWith('provider:test') ||
    accountId.startsWith('escrow:test') ||
    accountId.startsWith('test:')
}

export function isTestLedgerEntry(entry: {
  accountId: string
  createdBy: string
  referenceType: string
}): boolean {
  if (entry.createdBy === 'test' || entry.createdBy === 'test-5c1' || entry.createdBy === 'test-phase5c') return true
  if (entry.createdBy === 'system') {
    if (isTestAccount(entry.accountId)) return true
    if (entry.referenceType.startsWith('TEST')) return true
  }
  return false
}

export const FINANCIAL_EVENTS = {
  INSUFFICIENT_FUNDS: 'FINANCIAL_INSUFFICIENT_FUNDS',
  IDEMPOTENCY_CONFLICT: 'FINANCIAL_IDEMPOTENCY_CONFLICT',
  PAYOUT_REQUESTED: 'FINANCIAL_PAYOUT_REQUESTED',
  FUNDS_RESERVED: 'FINANCIAL_FUNDS_RESERVED',
  PAYOUT_PROCESSING: 'FINANCIAL_PAYOUT_PROCESSING',
  PAYOUT_SUCCEEDED: 'FINANCIAL_PAYOUT_SUCCEEDED',
  PAYOUT_FAILED: 'FINANCIAL_PAYOUT_FAILED',
  PAYOUT_REVERSAL: 'FINANCIAL_PAYOUT_REVERSAL',
  UNAUTHORIZED_FINANCIAL: 'FINANCIAL_UNAUTHORIZED_ACTION',
  ADMIN_FINANCIAL: 'FINANCIAL_ADMIN_ACTION',
  RECONCILIATION_MISMATCH: 'FINANCIAL_RECONCILIATION_MISMATCH',
  MALFORMED_WEBHOOK: 'FINANCIAL_MALFORMED_WEBHOOK',
  DUPLICATE_CALLBACK: 'FINANCIAL_DUPLICATE_CALLBACK',
  DB_TRANSACTION_FAILURE: 'FINANCIAL_DB_TRANSACTION_FAILURE',
} as const

export function emitFinancialEvent(event: string, data: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[FINANCIAL_EVENT] ${event}`, JSON.stringify(data))
  }
}
