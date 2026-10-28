export interface CommissionReceivableBalance {
  id: string
  amountRemaining: bigint
}

/** Allocate a verified bank credit oldest-first without exceeding due balances. */
export function allocateCommissionRemittance(
  receivables: CommissionReceivableBalance[],
  creditedMinor: bigint,
) {
  if (creditedMinor <= 0n) throw new Error('COMMISSION_REMITTANCE_AMOUNT_INVALID')
  const outstandingMinor = receivables.reduce((sum, item) => {
    if (item.amountRemaining <= 0n) throw new Error('COMMISSION_RECEIVABLE_BALANCE_INVALID')
    return sum + item.amountRemaining
  }, 0n)
  if (creditedMinor > outstandingMinor) throw new Error('COMMISSION_REMITTANCE_EXCEEDS_DUE')

  let remaining = creditedMinor
  const allocations: Array<{ receivableId: string; amountMinor: bigint; remainingMinor: bigint }> = []
  for (const receivable of receivables) {
    if (remaining === 0n) break
    const amountMinor = remaining < receivable.amountRemaining ? remaining : receivable.amountRemaining
    allocations.push({
      receivableId: receivable.id,
      amountMinor,
      remainingMinor: receivable.amountRemaining - amountMinor,
    })
    remaining -= amountMinor
  }
  return allocations
}
