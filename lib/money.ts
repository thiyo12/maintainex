export function formatMoney(cents: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}

export function dollarsToCents(dollars: string | number): number {
  const amount = typeof dollars === 'string' ? parseFloat(dollars) : dollars
  if (isNaN(amount)) return 0
  return Math.round(amount * 100)
}

export function calcPlatformFee(amountCents: number, feeBps: number): number {
  return Math.floor((amountCents * feeBps) / 10000)
}

export function formatBps(bps: number): string {
  return (bps / 100).toFixed(2) + '%'
}
