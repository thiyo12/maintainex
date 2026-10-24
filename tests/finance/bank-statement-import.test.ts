import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { hashBankStatement, normalizeBankStatementEntries, verifyBankEvidenceSignature } from '@/lib/finance/commissions/bank-statement-import'

const rows = [
  {
    transactionId: 'SYN-BANK-001', direction: 'CREDIT', amountMinor: '25000',
    currency: 'LKR', countryCode: 'LK', reference: 'MX-COMM-01',
  },
]

describe('commission bank statement import normalization', () => {
  it('normalizes only the bank evidence fields and hashes a canonical digest', () => {
    const normalized = normalizeBankStatementEntries(rows)
    expect(normalized[0]).toMatchObject({
      transactionId: 'SYN-BANK-001', direction: 'CREDIT', amountMinor: 25000n,
      currency: 'LKR', countryCode: 'LK', reference: 'MX-COMM-01',
      reversalOfTransactionId: null,
    })
    expect(hashBankStatement({ statementId: 'SYN-STATEMENT-01', accountRef: 'LK-FIN-01', countryCode: 'LK', currency: 'LKR', rows: normalized }))
      .toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(normalized, (_key, value) => typeof value === 'bigint' ? value.toString() : value)).not.toContain('accountHolder')
  })

  it.each([
    ['duplicate transaction ids', [rows[0], rows[0]], 'BANK_TRANSACTION_ID_INVALID_OR_DUPLICATE'],
    ['zero amount', [{ ...rows[0], amountMinor: '0' }], 'BANK_AMOUNT_INVALID'],
    ['fractional minor units', [{ ...rows[0], amountMinor: '12.5' }], 'BANK_AMOUNT_INVALID'],
    ['invalid market', [{ ...rows[0], countryCode: 'LKR' }], 'BANK_MARKET_INVALID'],
  ])('rejects %s', (_label, input, code) => {
    expect(() => normalizeBankStatementEntries(input)).toThrow(code)
  })

  it('rejects oversized statement batches before persistence', () => {
    expect(() => normalizeBankStatementEntries(Array.from({ length: 10_001 }, (_, index) => ({
      ...rows[0], transactionId: `SYN-${index}`,
    })))).toThrow('BANK_STATEMENT_ROW_COUNT_INVALID')
  })

  it('authenticates provider-neutral source callbacks with constant-time HMAC verification', () => {
    const rawBody = '{"sourceSystem":"synthetic-bank","statementId":"SYN-1"}'
    const secret = 'synthetic-bank-evidence-secret-32-bytes'
    const signature = createHmac('sha256', secret).update(rawBody).digest('hex')
    expect(verifyBankEvidenceSignature({ rawBody, signature: `sha256=${signature}`, secret })).toBe(true)
    expect(verifyBankEvidenceSignature({ rawBody: `${rawBody} `, signature: `sha256=${signature}`, secret })).toBe(false)
    expect(verifyBankEvidenceSignature({ rawBody, signature, secret: 'too-short' })).toBe(false)
  })
})
