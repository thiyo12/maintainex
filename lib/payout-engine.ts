import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

export async function requestPayout(
  userId: string,
  amountCents: bigint,
  method: string,
  bankDetails: string | null,
  idempotencyKey: string,
  createdBy: string
): Promise<PayoutResult> {
  const minPayoutCents = BigInt(500 * 100)
  if (amountCents < minPayoutCents) {
    return { ok: false, error: `Minimum withdrawal is LKR ${(Number(minPayoutCents) / 100).toFixed(0)}`, code: 'BELOW_MINIMUM' }
  }

  const payloadHash = `${userId}:${amountCents.toString()}:${method}`
  const existing = await prisma.idempotencyRecord.findUnique({ where: { idempotencyKey } })
  if (existing) {
    if (existing.metadata) {
      const parsed = JSON.parse(existing.metadata)
      if (parsed.payoutId && parsed.payloadHash === payloadHash) {
        return { ok: true, payoutId: parsed.payoutId, status: parsed.status as PayoutStatus }
      }
    }
    return { ok: false, error: 'Idempotency key conflict', code: 'IDEMPOTENCY_CONFLICT' }
  }

  const wallet = await prisma.providerWallet.findUnique({ where: { userId } })
  if (!wallet) return { ok: false, error: 'Provider wallet not found', code: 'WALLET_NOT_FOUND' }
  if (wallet.isFrozen) return { ok: false, error: 'Wallet is frozen', code: 'WALLET_FROZEN' }

  const walletId = wallet.id
  const amountNum = Number(amountCents) / 100

  try {
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ balance: number; available: number }>>(
        `SELECT balance, "availableBalance" as available FROM "WalletBalance"
         WHERE "walletId" = $1 AND "walletType" = 'PROVIDER' FOR UPDATE`,
        walletId
      )
      if (locked.length === 0) throw new Error('BALANCE_NOT_FOUND')

      const available = BigInt(Math.round(locked[0].available * 100))
      if (available < amountCents) throw new Error('INSUFFICIENT_FUNDS')

      const payout = await tx.payout.create({
        data: {
          userId,
          amount: amountCents,
          status: 'RESERVED',
          source: 'WITHDRAWAL',
          method,
          bankDetails,
          description: `Withdrawal request for ${(Number(amountCents) / 100).toFixed(0)} LKR`,
        }
      })

      const affected = await tx.$executeRawUnsafe(
        `UPDATE "WalletBalance"
         SET balance = balance - $3, "availableBalance" = "availableBalance" - $3, "updatedAt" = NOW()
         WHERE "walletId" = $1 AND "walletType" = 'PROVIDER' AND "availableBalance" >= $3`,
        walletId, 'PROVIDER', amountNum
      )
      if (affected === 0) throw new Error('INSUFFICIENT_FUNDS')

      await tx.$executeRawUnsafe(
        `INSERT INTO "FinancialLedger"
         (id, "accountId", "accountType", "entryType", amount, currency, "referenceType", "referenceId", "idempotencyKey", description, "createdBy", "createdAt")
         VALUES
         (gen_random_uuid()::text, $1, 'PROVIDER_WALLET', 'DEBIT', $2, 'LKR', 'WITHDRAWAL_RESERVED', $3, $4, $5, $6, NOW()),
         (gen_random_uuid()::text, 'platform', 'PLATFORM', 'CREDIT', $2, 'LKR', 'WITHDRAWAL_RESERVED', $3, $5 || ':platform', $5, $6, NOW())`,
        walletId, Number(amountCents), payout.id, idempotencyKey,
        `Withdrawal reservation for payout ${payout.id}`, createdBy
      )

      await tx.idempotencyRecord.create({
        data: {
          idempotencyKey,
          operation: 'PAYOUT_REQUEST',
          status: 'COMPLETED',
          metadata: JSON.stringify({ payoutId: payout.id, status: 'RESERVED', payloadHash }),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }
      })

      return payout
    })

    return { ok: true, payoutId: result.id, status: 'RESERVED' }
  } catch (e: any) {
    if (e.message === 'INSUFFICIENT_FUNDS') {
      return { ok: false, error: 'Insufficient funds', code: 'INSUFFICIENT_FUNDS' }
    }
    if (e.message === 'BALANCE_NOT_FOUND') {
      return { ok: false, error: 'Canonical balance not found', code: 'BALANCE_NOT_FOUND' }
    }
    throw e
  }
}

async function transitionPayout(
  payoutId: string,
  targetStatus: PayoutStatus,
  idempotencyKey: string,
  operation: string,
  extra: Record<string, unknown> = {}
): Promise<{ payout: { id: string; userId: string; amount: bigint; status: string }; locked: boolean }> {
  const existing = await prisma.idempotencyRecord.findUnique({ where: { idempotencyKey } })
  if (existing && existing.metadata) {
    const parsed = JSON.parse(existing.metadata)
    if (parsed.status) {
      return { payout: { id: payoutId, userId: '', amount: BigInt(0), status: parsed.status }, locked: false }
    }
  }

  return await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{ id: string; userId: string; amount: string; status: string }>>(
      `SELECT id, "userId", amount::text, status FROM "Payout" WHERE id = $1 FOR UPDATE`,
      payoutId
    )
    if (rows.length === 0) throw new Error('NOT_FOUND')

    const payout = rows[0]
    if (payout.status === targetStatus) {
      return { payout: { id: payout.id, userId: payout.userId, amount: BigInt(payout.amount), status: payout.status }, locked: false }
    }
    if (!isValidTransition(payout.status as PayoutStatus, targetStatus)) {
      throw new Error(`INVALID_TRANSITION:${payout.status}->${targetStatus}`)
    }

    const updateData: Record<string, unknown> = { status: targetStatus, ...extra }
    await tx.payout.update({ where: { id: payoutId }, data: updateData })

    await tx.idempotencyRecord.create({
      data: {
        idempotencyKey,
        operation,
        status: 'COMPLETED',
        metadata: JSON.stringify({ payoutId, status: targetStatus }),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }
    })

    return { payout: { id: payout.id, userId: payout.userId, amount: BigInt(payout.amount), status: payout.status }, locked: true }
  })
}

export async function markProcessing(
  payoutId: string, actorId: string, idempotencyKey: string
): Promise<PayoutResult> {
  try {
    const { payout, locked } = await transitionPayout(payoutId, 'PROCESSING', idempotencyKey, 'PAYOUT_PROCESSING', { processedBy: actorId })
    if (!locked) return { ok: true, payoutId, status: payout.status as PayoutStatus }
    return { ok: true, payoutId, status: 'PROCESSING' }
  } catch (e: any) {
    if (e.message === 'NOT_FOUND') return { ok: false, error: 'Payout not found', code: 'NOT_FOUND' }
    if (e.message?.startsWith('INVALID_TRANSITION')) return { ok: false, error: e.message, code: 'INVALID_TRANSITION' }
    throw e
  }
}

export async function markSucceeded(
  payoutId: string, providerRef: string | null, idempotencyKey: string, createdBy: string
): Promise<PayoutResult> {
  const existing = await prisma.idempotencyRecord.findUnique({ where: { idempotencyKey } })
  if (existing && existing.metadata) {
    const parsed = JSON.parse(existing.metadata)
    if (parsed.status) return { ok: true, payoutId, status: parsed.status as PayoutStatus }
  }

  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{ id: string; userId: string; amount: string; status: string }>>(
      `SELECT id, "userId", amount::text, status FROM "Payout" WHERE id = $1 FOR UPDATE`,
      payoutId
    )
    if (rows.length === 0) throw new Error('NOT_FOUND')
    const payout = rows[0]
    if (payout.status === 'SUCCEEDED') {
      return { ok: true, payoutId, status: payout.status as PayoutStatus }
    }
    if (!isValidTransition(payout.status as PayoutStatus, 'SUCCEEDED')) {
      throw new Error(`INVALID_TRANSITION:${payout.status}->SUCCEEDED`)
    }

    await tx.payout.update({ where: { id: payoutId }, data: { status: 'SUCCEEDED', clearedAt: new Date() } })

    await tx.$executeRawUnsafe(
      `INSERT INTO "FinancialLedger"
       (id, "accountId", "accountType", "entryType", amount, currency, "referenceType", "referenceId", "idempotencyKey", description, "createdBy", "createdAt")
       VALUES
       (gen_random_uuid()::text, 'platform', 'PLATFORM', 'DEBIT', $1, 'LKR', 'PAYOUT_SUCCEEDED', $2, $3, $4, $5, NOW()),
       (gen_random_uuid()::text, 'platform', 'PLATFORM', 'CREDIT', $1, 'LKR', 'WITHDRAWAL_RESERVED', $2, $3 || ':reserved-reverse', $4, $5, NOW())`,
      Number(payout.amount), payout.id, idempotencyKey,
      `Payout ${payoutId} completed${providerRef ? ` (ref: ${providerRef})` : ''}`, createdBy
    )

    await tx.idempotencyRecord.create({
      data: {
        idempotencyKey,
        operation: 'PAYOUT_SUCCEEDED',
        status: 'COMPLETED',
        metadata: JSON.stringify({ payoutId, status: 'SUCCEEDED', providerRef }),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }
    })

    return payout
  })

  return { ok: true, payoutId, status: 'SUCCEEDED' }
}

export async function markFailed(
  payoutId: string, reason: string, idempotencyKey: string, createdBy: string
): Promise<PayoutResult> {
  const existing = await prisma.idempotencyRecord.findUnique({ where: { idempotencyKey } })
  if (existing && existing.metadata) {
    const parsed = JSON.parse(existing.metadata)
    if (parsed.status) return { ok: true, payoutId, status: parsed.status as PayoutStatus }
  }

  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{ id: string; userId: string; amount: string; status: string }>>(
      `SELECT id, "userId", amount::text, status FROM "Payout" WHERE id = $1 FOR UPDATE`,
      payoutId
    )
    if (rows.length === 0) throw new Error('NOT_FOUND')
    const payout = rows[0]
    if (['SUCCEEDED', 'FAILED', 'REVERSED', 'CANCELLED'].includes(payout.status)) {
      return { ok: true, payoutId, status: payout.status as PayoutStatus }
    }
    if (!isValidTransition(payout.status as PayoutStatus, 'FAILED')) {
      throw new Error(`INVALID_TRANSITION:${payout.status}->FAILED`)
    }

    const wallets = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "ProviderWallet" WHERE "userId" = $1`, payout.userId
    )
    if (wallets.length === 0) throw new Error('WALLET_NOT_FOUND')
    const walletId = wallets[0].id

    await tx.payout.update({ where: { id: payoutId }, data: { status: 'FAILED', rejectedReason: reason } })

    await tx.$executeRawUnsafe(
      `UPDATE "WalletBalance"
       SET balance = balance + $3, "availableBalance" = "availableBalance" + $3, "updatedAt" = NOW()
       WHERE "walletId" = $1 AND "walletType" = 'PROVIDER'`,
      walletId, 'PROVIDER', Number(payout.amount) / 100
    )

    await tx.$executeRawUnsafe(
      `INSERT INTO "FinancialLedger"
       (id, "accountId", "accountType", "entryType", amount, currency, "referenceType", "referenceId", "idempotencyKey", description, "createdBy", "createdAt")
       VALUES
       (gen_random_uuid()::text, 'platform', 'PLATFORM', 'DEBIT', $1, 'LKR', 'WITHDRAWAL_RELEASED', $2, $3, $4, $5, NOW()),
       (gen_random_uuid()::text, $6, 'PROVIDER_WALLET', 'CREDIT', $1, 'LKR', 'WITHDRAWAL_RELEASED', $2, $3 || ':wallet', $4, $5, NOW())`,
      Number(payout.amount), payout.id, idempotencyKey,
      `Payout ${payoutId} failed: ${reason} — funds restored`, createdBy, walletId
    )

    await tx.idempotencyRecord.create({
      data: {
        idempotencyKey,
        operation: 'PAYOUT_FAILED',
        status: 'COMPLETED',
        metadata: JSON.stringify({ payoutId, status: 'FAILED' }),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }
    })

    return payout
  })

  return { ok: true, payoutId, status: 'FAILED' }
}

export async function cancelPayout(
  payoutId: string, reason: string, idempotencyKey: string, createdBy: string
): Promise<PayoutResult> {
  const existing = await prisma.idempotencyRecord.findUnique({ where: { idempotencyKey } })
  if (existing && existing.metadata) {
    const parsed = JSON.parse(existing.metadata)
    if (parsed.status) return { ok: true, payoutId, status: parsed.status as PayoutStatus }
  }

  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{ id: string; userId: string; amount: string; status: string }>>(
      `SELECT id, "userId", amount::text, status FROM "Payout" WHERE id = $1 FOR UPDATE`,
      payoutId
    )
    if (rows.length === 0) throw new Error('NOT_FOUND')
    const payout = rows[0]
    if (!isValidTransition(payout.status as PayoutStatus, 'CANCELLED')) {
      throw new Error(`INVALID_TRANSITION:${payout.status}->CANCELLED`)
    }

    const needsRestore = payout.status === 'RESERVED' || payout.status === 'PROCESSING'

    await tx.payout.update({ where: { id: payoutId }, data: { status: 'CANCELLED', rejectedReason: reason } })

    if (needsRestore) {
      const wallets = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "ProviderWallet" WHERE "userId" = $1`, payout.userId
      )
      if (wallets.length > 0) {
        const walletId = wallets[0].id
        const restoreAmount = Number(payout.amount) / 100
        await tx.$executeRawUnsafe(
          `UPDATE "WalletBalance"
           SET balance = balance + $3, "availableBalance" = "availableBalance" + $3, "updatedAt" = NOW()
           WHERE "walletId" = $1 AND "walletType" = 'PROVIDER'`,
          walletId, 'PROVIDER', restoreAmount
        )

        await tx.$executeRawUnsafe(
          `INSERT INTO "FinancialLedger"
           (id, "accountId", "accountType", "entryType", amount, currency, "referenceType", "referenceId", "idempotencyKey", description, "createdBy", "createdAt")
           VALUES
           (gen_random_uuid()::text, 'platform', 'PLATFORM', 'DEBIT', $1, 'LKR', 'WITHDRAWAL_RELEASED', $2, $3, $4, $5, NOW()),
           (gen_random_uuid()::text, $6, 'PROVIDER_WALLET', 'CREDIT', $1, 'LKR', 'WITHDRAWAL_RELEASED', $2, $3 || ':wallet', $4, $5, NOW())`,
          Number(payout.amount), payout.id, idempotencyKey,
          `Payout ${payoutId} cancelled: ${reason} — funds restored`, createdBy, walletId
        )
      }
    }

    await tx.idempotencyRecord.create({
      data: {
        idempotencyKey,
        operation: 'PAYOUT_CANCEL',
        status: 'COMPLETED',
        metadata: JSON.stringify({ payoutId, status: 'CANCELLED' }),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }
    })

    return payout
  })

  return { ok: true, payoutId, status: 'CANCELLED' }
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
