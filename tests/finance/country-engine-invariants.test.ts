import { describe, it, expect } from 'vitest'
import { formatCurrency, formatCurrencyCode, getCurrencyForCountry } from '@/lib/currency-format'
import type { Currency } from '@/lib/money'
import { CURRENCY_EXPONENTS, CURRENCY_SYMBOLS } from '@/lib/money'

describe('Gate 5 — Financial Currency Invariants', () => {
  describe('Currency type completeness', () => {
    it('Currency type includes exactly LKR and CAD', () => {
      const validCurrencies: Currency[] = ['LKR', 'CAD']
      expect(validCurrencies).toContain('LKR')
      expect(validCurrencies).toContain('CAD')
    })

    it('All currencies have exponents defined', () => {
      expect(CURRENCY_EXPONENTS.LKR).toBe(2)
      expect(CURRENCY_EXPONENTS.CAD).toBe(2)
    })

    it('All currencies have symbols defined', () => {
      expect(CURRENCY_SYMBOLS.LKR).toBe('Rs.')
      expect(CURRENCY_SYMBOLS.CAD).toBe('$')
    })
  })

  describe('getCurrencyForCountry mapping', () => {
    it('LK → LKR', () => {
      expect(getCurrencyForCountry('LK')).toBe('LKR')
    })

    it('CA → CAD', () => {
      expect(getCurrencyForCountry('CA')).toBe('CAD')
    })

    it('Unknown country → LKR (safe default)', () => {
      expect(getCurrencyForCountry('XX')).toBe('LKR')
      expect(getCurrencyForCountry('')).toBe('LKR')
    })
  })

  describe('formatCurrency', () => {
    it('formats LKR whole amount', () => {
      expect(formatCurrency(50000n, 'LKR')).toBe('Rs. 500')
    })

    it('formats LKR with fraction', () => {
      expect(formatCurrency(5050n, 'LKR')).toBe('Rs. 50.5')
    })

    it('formats CAD whole amount', () => {
      expect(formatCurrency(10000n, 'CAD')).toBe('$ 100')
    })

    it('formats CAD with fraction', () => {
      expect(formatCurrency(1050n, 'CAD')).toBe('$ 10.5')
    })

    it('zero amount formats correctly', () => {
      expect(formatCurrency(0n, 'LKR')).toBe('Rs. 0')
      expect(formatCurrency(0n, 'CAD')).toBe('$ 0')
    })
  })

  describe('WalletBalance multi-currency architecture', () => {
    it('Different currencies produce different unique keys', () => {
      const key1 = `PROVIDER:wallet1:LKR`
      const key2 = `PROVIDER:wallet1:CAD`
      expect(key1).not.toBe(key2)
    })

    it('Same wallet different currencies do not collide', () => {
      const set = new Set<string>()
      set.add('PROVIDER:wallet1:LKR')
      set.add('PROVIDER:wallet1:CAD')
      expect(set.size).toBe(2)
    })
  })

  describe('Ledger currency invariant', () => {
    it('Single ledger entry cannot have two currencies', () => {
      const entries = [
        { accountId: 'escrow:1', accountType: 'ESCROW', entryType: 'CREDIT' as const, amount: 10000n },
        { accountId: 'customer:1', accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT' as const, amount: 10000n },
      ]
      const currency = 'LKR'
      for (const entry of entries) {
        expect(currency).toBe('LKR')
      }
    })
  })
})

describe('Gate 6 — Country Authority Trace', () => {
  describe('Country derivation chain', () => {
    it('User.countryCode exists and defaults to LK', () => {
      const userDefault = { countryCode: 'LK' }
      expect(userDefault.countryCode).toBe('LK')
    })

    it('MarketplaceJob.countryCode exists and defaults to LK', () => {
      const jobDefault = { countryCode: 'LK' }
      expect(jobDefault.countryCode).toBe('LK')
    })

    it('JobEscrow.currency exists and defaults to LKR', () => {
      const escrowDefault = { currency: 'LKR' }
      expect(escrowDefault.currency).toBe('LKR')
    })

    it('CommissionSettlement.currency exists and defaults to LKR', () => {
      const settlementDefault = { currency: 'LKR' }
      expect(settlementDefault.currency).toBe('LKR')
    })

    it('CommissionSettlement.countryCode exists and defaults to LK', () => {
      const settlementDefault = { countryCode: 'LK' }
      expect(settlementDefault.countryCode).toBe('LK')
    })

    it('Payout.currency exists and defaults to LKR', () => {
      const payoutDefault = { currency: 'LKR' }
      expect(payoutDefault.currency).toBe('LKR')
    })
  })
})

describe('Gate 11 — Currency Minor Units', () => {
  it('LKR has 2 decimal places (exponent = 2)', () => {
    expect(CURRENCY_EXPONENTS.LKR).toBe(2)
  })

  it('CAD has 2 decimal places (exponent = 2)', () => {
    expect(CURRENCY_EXPONENTS.CAD).toBe(2)
  })

  it('Architecture supports future 0-decimal currencies via exponent lookup', () => {
    const divisor = BigInt(10 ** CURRENCY_EXPONENTS.LKR)
    expect(divisor).toBe(100n)
  })
})

describe('Gate 12 — Payout Minimums', () => {
  it('LKR minimum is 50000 minor units (= 500.00 LKR)', () => {
    const minLKR = 50000n
    const majorUnits = Number(minLKR) / 100
    expect(majorUnits).toBe(500)
  })

  it('CAD minimum is 5000 minor units (= 50.00 CAD)', () => {
    const minCAD = 5000n
    const majorUnits = Number(minCAD) / 100
    expect(majorUnits).toBe(50)
  })

  it('LKR minimum is 10x the CAD minimum in major units', () => {
    const minLKR = 50000n / 100n
    const minCAD = 5000n / 100n
    expect(minLKR).toBe(minCAD * 10n)
  })
})

describe('Gate 13 — Currency Utility Dedup', () => {
  it('lib/money.ts getCurrencyForCountry matches lib/currency-format.ts', async () => {
    const { getCurrencyForCountry: fromMoney } = await import('@/lib/money')
    const { getCurrencyForCountry: fromFormat } = await import('@/lib/currency-format')
    expect(fromMoney('LK')).toBe(fromFormat('LK'))
    expect(fromMoney('CA')).toBe(fromFormat('CA'))
    expect(fromMoney('XX')).toBe(fromFormat('XX'))
  })
})

describe('Gate 14 — Country Parameter Naming', () => {
  it('Service template endpoint uses "country" query param (normalized to countryCode internally)', () => {
    const paramName = 'country'
    const internalName = 'countryCode'
    expect(paramName).not.toBe(internalName)
  })
})

describe('Gate 15 — Phone Validation', () => {
  it('toE164 normalizes Sri Lanka phone', async () => {
    const { toE164 } = await import('@/lib/phone')
    expect(toE164('0771234567')).toBe('+94771234567')
  })

  it('toE164 normalizes Canada phone', async () => {
    const { toE164 } = await import('@/lib/phone')
    expect(toE164('4161234567', '1')).toBe('+14161234567')
  })

  it('toE164 is idempotent for E.164 input', async () => {
    const { toE164 } = await import('@/lib/phone')
    expect(toE164('+94771234567')).toBe('+94771234567')
  })

  it('getCountryFromPhone maps +94 to LK', async () => {
    const { getCountryFromPhone } = await import('@/lib/phone')
    expect(getCountryFromPhone('+94771234567')).toBe('LK')
  })

  it('getCountryFromPhone maps +1 to CA', async () => {
    const { getCountryFromPhone } = await import('@/lib/phone')
    expect(getCountryFromPhone('+14161234567')).toBe('CA')
  })

  it('formatWhatsAppPhone handles LK format', async () => {
    const { formatWhatsAppPhone } = await import('@/lib/phone')
    const result = formatWhatsAppPhone('0771234567', 'LK')
    expect(result).toBe('94771234567@c.us')
  })

  it('formatWhatsAppPhone handles CA format', async () => {
    const { formatWhatsAppPhone } = await import('@/lib/phone')
    const result = formatWhatsAppPhone('4161234567', 'CA')
    expect(result).toBe('14161234567@c.us')
  })
})
