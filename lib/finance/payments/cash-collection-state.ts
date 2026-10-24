export type CashCollectionStatus =
  | 'NOT_REPORTED'
  | 'PROVIDER_REPORTED'
  | 'CUSTOMER_CONFIRMED'
  | 'CONTESTED'

export type CashReportDecision = 'RETRY' | 'ACCEPT' | 'REJECT'

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
