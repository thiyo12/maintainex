export type BankCreditMatchResult =
  | { status: 'MATCHED'; transactionId: string; amountMinor: bigint; debtorId: string; debtorType: 'TASKER' | 'COMPANY' }
  | { status: 'DUPLICATE'; transactionId: string }
  | { status: 'REVERSED'; transactionId: string; reversesTransactionId: string }
  | { status: 'MISMATCH'; transactionId: string | null; code: string }

export interface CommissionBankCreditFixture {
  bankAccountRef: string
  transactionId: string
  direction: 'CREDIT' | 'DEBIT'
  amountMinor: bigint
  currency: string
  countryCode: string
  reference: string
  reversalOfTransactionId?: string | null
}

export interface CommissionPaymentExpectation {
  bankAccountRef: string
  reference: string
  debtorId: string
  debtorType: 'TASKER' | 'COMPANY'
  amountDueMinor: bigint
  currency: string
  countryCode: string
}

/** Match a bank statement credit to the exact open provider obligation. */
export function matchCommissionBankCredit(input: {
  credit: CommissionBankCreditFixture
  expected: CommissionPaymentExpectation
  knownTransactionIds?: ReadonlySet<string>
}): BankCreditMatchResult {
  const { credit, expected } = input
  const transactionId = credit.transactionId.trim()
  if (!transactionId || transactionId.length > 200) return { status: 'MISMATCH', transactionId: null, code: 'BANK_TRANSACTION_ID_INVALID' }
  if (input.knownTransactionIds?.has(transactionId)) return { status: 'DUPLICATE', transactionId }
  if (credit.reversalOfTransactionId) {
    return { status: 'REVERSED', transactionId, reversesTransactionId: credit.reversalOfTransactionId.trim() }
  }
  if (credit.direction !== 'CREDIT') return { status: 'MISMATCH', transactionId, code: 'BANK_ENTRY_NOT_CREDIT' }
  if (!expected.debtorId || !['TASKER', 'COMPANY'].includes(expected.debtorType)) {
    return { status: 'MISMATCH', transactionId, code: 'COMMISSION_DEBTOR_INVALID' }
  }
  if (credit.bankAccountRef.trim() !== expected.bankAccountRef.trim()) {
    return { status: 'MISMATCH', transactionId, code: 'BANK_ACCOUNT_MISMATCH' }
  }
  if (credit.reference.trim() !== expected.reference.trim()) {
    return { status: 'MISMATCH', transactionId, code: 'BANK_REFERENCE_MISMATCH' }
  }
  if (credit.countryCode.trim().toUpperCase() !== expected.countryCode.trim().toUpperCase()) {
    return { status: 'MISMATCH', transactionId, code: 'BANK_COUNTRY_MISMATCH' }
  }
  if (credit.currency.trim().toUpperCase() !== expected.currency.trim().toUpperCase()) {
    return { status: 'MISMATCH', transactionId, code: 'BANK_CURRENCY_MISMATCH' }
  }
  if (credit.amountMinor <= 0n || credit.amountMinor > expected.amountDueMinor) {
    return { status: 'MISMATCH', transactionId, code: 'BANK_AMOUNT_MISMATCH' }
  }
  return {
    status: 'MATCHED',
    transactionId,
    amountMinor: credit.amountMinor,
    debtorId: expected.debtorId,
    debtorType: expected.debtorType,
  }
}
