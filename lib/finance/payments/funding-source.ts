import type { PrismaClient, Prisma } from '@prisma/client'

type DbClient = PrismaClient | Prisma.TransactionClient

export type EscrowFundingSource = 'PAYHERE' | 'PAYPAL' | 'WALLET' | 'UNKNOWN'

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
    if (debit.accountId === 'external:payhere') {
      return 'PAYHERE'
    }
    if (debit.accountId === 'external:paypal') return 'PAYPAL'
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
    select: { id: true, gateway: true },
    orderBy: { createdAt: 'desc' },
  })

  if (capturedPayment?.gateway === 'PAYHERE' || capturedPayment?.gateway === 'PAYPAL') {
    return capturedPayment.gateway
  }
  return 'UNKNOWN'
}
