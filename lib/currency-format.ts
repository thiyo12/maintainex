import { Currency, CURRENCY_SYMBOLS, CURRENCY_EXPONENTS, getCurrencyForCountry } from './money'

export function formatCurrency(amountCents: bigint, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency]
  const exponent = CURRENCY_EXPONENTS[currency]
  const divisor = BigInt(10 ** exponent)
  const whole = amountCents / divisor
  const fraction = amountCents % divisor
  if (fraction === 0n) return `${symbol} ${whole.toLocaleString()}`
  return `${symbol} ${whole.toLocaleString()}.${fraction.toString().padStart(exponent, '0').replace(/0+$/, '')}`
}

export function formatCurrencyCode(amountCents: bigint, currency: Currency): string {
  const exponent = CURRENCY_EXPONENTS[currency]
  const divisor = BigInt(10 ** exponent)
  const whole = amountCents / divisor
  const fraction = amountCents % divisor
  if (fraction === 0n) return `${whole.toLocaleString()} ${currency}`
  return `${whole.toLocaleString()}.${fraction.toString().padStart(exponent, '0').replace(/0+$/, '')} ${currency}`
}

export { getCurrencyForCountry }
