import type { PrismaClient, Prisma } from '@prisma/client'

type DbClient = PrismaClient | Prisma.TransactionClient

export type EscrowFundingSource = 'PAYHERE' | 'WALLET' | 'UNKNOWN'

export async function resolveEscrowFundingSource(
  client: DbClient,
  escrowId: string
): Promise<EscrowFundingSource> {
  const debit = await client.financialLedger.findFirst({
    where: {
      referenceType: 'ESCROW_DEPOSIT',
      referenceId: escrowId,
      entryType: 'DEBIT',
    },
    select: {
      accountId: true,
      accountType: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  if (debit) {
    if (debit.accountId === 'external:payhere' || debit.accountType === 'EXTERNAL_PAYOUT') {
      return 'PAYHERE'
    }
    if (debit.accountType === 'CUSTOMER_WALLET') {
      return 'WALLET'
    }
  }

  const capturedPayment = await client.paymentIntent.findFirst({
    where: {
      escrowId,
      status: {
        in: ['SUCCESS', 'REFUND_REQUIRED', 'REFUND_PROCESSING', 'REFUNDED', 'CHARGEDBACK'],
      },
    },
    select: { id: true },
  })

  if (capturedPayment) return 'PAYHERE'
  return 'UNKNOWN'
}
