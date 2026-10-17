import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  currencyForJobCountry, parseCounterofferAmount, quoteMatchesJobCurrency,
} from '../../apps/mobile/lib/market-currency'

const source = readFileSync(resolve(process.cwd(),
  'apps/mobile/features/jobs/screens/customer/v2/[id].tsx'), 'utf8')

describe('Phase 06 — mobile quote bargain currency and amount isolation', () => {
  it('derives display currency only from the canonical booking market', () => {
    expect(currencyForJobCountry('LK')).toBe('LKR')
    expect(currencyForJobCountry('CA')).toBe('CAD')
    expect(currencyForJobCountry('ca')).toBe('CAD')
    for (const country of ['', 'US', 'GLOBAL', 'GB', undefined]) {
      expect(currencyForJobCountry(country)).toBeNull()
    }
  })

  it('rejects stale or mismatched quote currencies before acceptance or negotiation', () => {
    expect(quoteMatchesJobCurrency('LK', 'LKR')).toBe(true)
    expect(quoteMatchesJobCurrency('CA', 'CAD')).toBe(true)
    expect(quoteMatchesJobCurrency('CA', 'LKR')).toBe(false)
    expect(quoteMatchesJobCurrency('LK', 'CAD')).toBe(false)
    expect(quoteMatchesJobCurrency('US', 'CAD')).toBe(false)
    expect(quoteMatchesJobCurrency('CA', undefined)).toBe(false)
  })

  it.each(['', '0', '-1', '+20', '1.234', '100junk', '1e4',
    'Infinity', 'NaN', '12,000', '0.001', '9007199254740999'])(
    'rejects invalid or imprecise offer text %s',
    value => expect(parseCounterofferAmount(value)).toBeNull(),
  )

  it('retains exact supported cents, without truncation', () => {
    expect(parseCounterofferAmount('100')).toBe(100)
    expect(parseCounterofferAmount(' 24.50 ')).toBe(24.5)
    expect(parseCounterofferAmount('0.01')).toBe(0.01)
    expect(parseCounterofferAmount('99.99')).toBe(99.99)
  })

  it('blocks wrong-market quotes in UI as well as in action handlers', () => {
    expect(source).toContain('quoteMatchesJobCurrency(job?.countryCode, quote.currency)')
    expect(source).toContain('quoteMatchesJobCurrency(job.countryCode, q.currency)')
    expect(source).toContain('parseCounterofferAmount(bargainPrice)')
    expect(source).not.toContain('parseInt(bargainPrice, 10)')
    expect(source).not.toContain('would you accept LKR')
    expect(source).not.toContain('placeholder="LKR 0"')
    expect(source).toContain('quoteCurrencyIsValid')
  })

  it('does not hardcode LK prices on Vancouver job surfaces', () => {
    expect(source).toContain('currencyForJobCountry(job?.countryCode)')
    expect(source).not.toContain('>LKR {')
    expect(source).not.toContain('Deposit LKR')
    expect(source).not.toContain('AI estimate.symbol ||')
  })
})
