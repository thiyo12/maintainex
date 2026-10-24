import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export interface NormalizedBankStatementEntry {
  transactionId: string
  direction: 'CREDIT' | 'DEBIT'
  amountMinor: bigint
  currency: string
  countryCode: string
  reference: string
  reversalOfTransactionId: string | null
}

export function normalizeBankStatementEntries(input: unknown): NormalizedBankStatementEntry[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 10_000) {
    throw new Error('BANK_STATEMENT_ROW_COUNT_INVALID')
  }
  const seen = new Set<string>()
  return input.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('BANK_STATEMENT_ROW_INVALID')
    }
    const row = value as Record<string, unknown>
    const transactionId = typeof row.transactionId === 'string' ? row.transactionId.trim() : ''
    const direction = typeof row.direction === 'string' ? row.direction.trim().toUpperCase() : ''
    const currency = typeof row.currency === 'string' ? row.currency.trim().toUpperCase() : ''
    const countryCode = typeof row.countryCode === 'string' ? row.countryCode.trim().toUpperCase() : ''
    const reference = typeof row.reference === 'string' ? row.reference.trim() : ''
    const reversalOfTransactionId = row.reversalOfTransactionId == null
      ? null
      : typeof row.reversalOfTransactionId === 'string'
        ? row.reversalOfTransactionId.trim()
        : ''
    const amountText = typeof row.amountMinor === 'string' ? row.amountMinor : ''
    if (!transactionId || transactionId.length > 200 || seen.has(transactionId)) {
      throw new Error('BANK_TRANSACTION_ID_INVALID_OR_DUPLICATE')
    }
    if (direction !== 'CREDIT' && direction !== 'DEBIT') throw new Error('BANK_DIRECTION_INVALID')
    if (!/^[A-Z]{3}$/.test(currency) || !/^[A-Z]{2}$/.test(countryCode)) {
      throw new Error('BANK_MARKET_INVALID')
    }
    if (!/^[1-9][0-9]{0,17}$/.test(amountText)) throw new Error('BANK_AMOUNT_INVALID')
    if (!reference || reference.length > 200) throw new Error('BANK_REFERENCE_INVALID')
    if (reversalOfTransactionId !== null && (!reversalOfTransactionId || reversalOfTransactionId.length > 200)) {
      throw new Error('BANK_REVERSAL_REFERENCE_INVALID')
    }
    seen.add(transactionId)
    return {
      transactionId,
      direction,
      amountMinor: BigInt(amountText),
      currency,
      countryCode,
      reference,
      reversalOfTransactionId,
    }
  })
}

export function hashBankStatement(input: {
  statementId: string
  accountRef: string
  countryCode: string
  currency: string
  rows: NormalizedBankStatementEntry[]
}): string {
  const canonical = JSON.stringify({
    statementId: input.statementId,
    accountRef: input.accountRef,
    countryCode: input.countryCode,
    currency: input.currency,
    rows: input.rows.map((row) => ({
      transactionId: row.transactionId,
      direction: row.direction,
      amountMinor: row.amountMinor.toString(),
      currency: row.currency,
      countryCode: row.countryCode,
      reference: row.reference,
      reversalOfTransactionId: row.reversalOfTransactionId,
    })),
  })
  return createHash('sha256').update(canonical).digest('hex')
}

export function verifyBankEvidenceSignature(input: {
  rawBody: string
  signature: string | null
  secret: string
}): boolean {
  if (!input.signature || input.secret.length < 32) return false
  const supplied = input.signature.startsWith('sha256=') ? input.signature.slice(7) : input.signature
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false
  const expected = createHmac('sha256', input.secret).update(input.rawBody).digest()
  const actual = Buffer.from(supplied, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
