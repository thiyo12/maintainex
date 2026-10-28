export type CashCollectionStatus =
  | 'NOT_REPORTED'
  | 'PROVIDER_REPORTED'
  | 'CUSTOMER_CONFIRMED'
  | 'CONTESTED'

export type CashReportDecision = 'RETRY' | 'ACCEPT' | 'REJECT'

/** Commission due on a newly confirmed cumulative cash total, in minor units. */
export function calculateIncrementalCashCommission(input: {
  previousCollectedMinor: bigint
  nextCollectedMinor: bigint
  chargeableLimitMinor: bigint
  commissionRateBps: bigint
}): bigint {
  if (
    input.previousCollectedMinor < 0n || input.nextCollectedMinor < 0n ||
    input.chargeableLimitMinor < 0n || input.commissionRateBps < 0n ||
    input.commissionRateBps > 10000n
  ) throw new Error('Invalid cash commission inputs')
  const previousBase = input.previousCollectedMinor < input.chargeableLimitMinor
    ? input.previousCollectedMinor
    : input.chargeableLimitMinor
  const nextBase = input.nextCollectedMinor < input.chargeableLimitMinor
    ? input.nextCollectedMinor
    : input.chargeableLimitMinor
  const previousDue = previousBase * input.commissionRateBps / 10000n
  const nextDue = nextBase * input.commissionRateBps / 10000n
  return nextDue - previousDue
}

/** Reports are cumulative cash received to date; an agreed total can increase later. */
export function decideCashCollectionReport(input: {
  status: string
  previousAmountMinor: bigint | null
  reportedAmountMinor: bigint
  sameReporter: boolean
}): CashReportDecision {
  const previousAmount = input.previousAmountMinor ?? 0n
  const sameAmount = input.reportedAmountMinor === previousAmount

  if (
    input.sameReporter && sameAmount &&
    (input.status === 'PROVIDER_REPORTED' || input.status === 'CUSTOMER_CONFIRMED')
  ) return 'RETRY'

  if (input.status === 'NOT_REPORTED' || input.status === 'CONTESTED') return 'ACCEPT'
  if (input.status === 'CUSTOMER_CONFIRMED' && input.reportedAmountMinor > previousAmount) return 'ACCEPT'
  return 'REJECT'
}
