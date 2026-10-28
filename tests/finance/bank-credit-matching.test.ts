import { describe, expect, it } from 'vitest'
import { matchCommissionBankCredit } from '@/lib/finance/commissions/bank-credit-matching'
import { syntheticBankStatementCredits, syntheticCommissionPayment } from '../fixtures/finance/commission-bank-statement.synthetic'

describe('provider-neutral bank credit matching', () => {
  it('matches exact synthetic statement records and supports partial remittances', () => {
    for (const credit of syntheticBankStatementCredits) {
      expect(matchCommissionBankCredit({ credit, expected: syntheticCommissionPayment })).toMatchObject({
        status: 'MATCHED', debtorId: 'synthetic-tasker-01', debtorType: 'TASKER',
      })
    }
  })

  it.each([
    ['bank account', { bankAccountRef: 'UNRELATED-ACCOUNT' }, 'BANK_ACCOUNT_MISMATCH'],
    ['reference', { reference: 'UNRELATED-REFERENCE' }, 'BANK_REFERENCE_MISMATCH'],
    ['country', { countryCode: 'CA' }, 'BANK_COUNTRY_MISMATCH'],
    ['currency', { currency: 'CAD' }, 'BANK_CURRENCY_MISMATCH'],
    ['amount', { amountMinor: 100001n }, 'BANK_AMOUNT_MISMATCH'],
    ['debit', { direction: 'DEBIT' as const }, 'BANK_ENTRY_NOT_CREDIT'],
  ])('rejects a %s mismatch', (_label, override, code) => {
    const result = matchCommissionBankCredit({
      credit: { ...syntheticBankStatementCredits[0], ...override },
      expected: syntheticCommissionPayment,
    })
    expect(result).toMatchObject({ status: 'MISMATCH', code })
  })

  it('detects duplicate statement transaction ids without reapplying a credit', () => {
    expect(matchCommissionBankCredit({
      credit: syntheticBankStatementCredits[0],
      expected: syntheticCommissionPayment,
      knownTransactionIds: new Set(['SYNTHETIC-BANK-TXN-001']),
    })).toEqual({ status: 'DUPLICATE', transactionId: 'SYNTHETIC-BANK-TXN-001' })
  })

  it('classifies linked bank reversals for review instead of treating them as credits', () => {
    expect(matchCommissionBankCredit({
      credit: { ...syntheticBankStatementCredits[0], transactionId: 'SYNTHETIC-BANK-REV-001', direction: 'DEBIT', reversalOfTransactionId: 'SYNTHETIC-BANK-TXN-001' },
      expected: syntheticCommissionPayment,
    })).toEqual({
      status: 'REVERSED', transactionId: 'SYNTHETIC-BANK-REV-001',
      reversesTransactionId: 'SYNTHETIC-BANK-TXN-001',
    })
  })

  it('attributes company remittance to the company legal debtor, never its worker', () => {
    const result = matchCommissionBankCredit({
      credit: { ...syntheticBankStatementCredits[0], reference: 'MX-COMM-COMPANY-01' },
      expected: {
        ...syntheticCommissionPayment,
        reference: 'MX-COMM-COMPANY-01',
        debtorId: 'synthetic-company-01',
        debtorType: 'COMPANY',
      },
    })
    expect(result).toMatchObject({ debtorId: 'synthetic-company-01', debtorType: 'COMPANY' })
  })
})
