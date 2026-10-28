import type { CommissionBankCreditFixture, CommissionPaymentExpectation } from '@/lib/finance/commissions/bank-credit-matching'

export const syntheticCommissionPayment: CommissionPaymentExpectation = {
  bankAccountRef: 'SYNTHETIC-LK-MAINTAINEX-01',
  reference: 'MX-COMM-2026-10-TASKER-01',
  debtorId: 'synthetic-tasker-01',
  debtorType: 'TASKER',
  amountDueMinor: 100000n,
  currency: 'LKR',
  countryCode: 'LK',
}

export const syntheticBankStatementCredits: CommissionBankCreditFixture[] = [
  {
    bankAccountRef: 'SYNTHETIC-LK-MAINTAINEX-01', transactionId: 'SYNTHETIC-BANK-TXN-001',
    direction: 'CREDIT', amountMinor: 40000n, currency: 'LKR', countryCode: 'LK',
    reference: 'MX-COMM-2026-10-TASKER-01',
  },
  {
    bankAccountRef: 'SYNTHETIC-LK-MAINTAINEX-01', transactionId: 'SYNTHETIC-BANK-TXN-002',
    direction: 'CREDIT', amountMinor: 60000n, currency: 'LKR', countryCode: 'LK',
    reference: 'MX-COMM-2026-10-TASKER-01',
  },
]
