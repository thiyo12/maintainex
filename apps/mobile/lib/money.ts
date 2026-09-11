export type Currency = 'LKR' | 'CAD';

export const CURRENCY_EXPONENTS: Record<Currency, number> = {
  LKR: 2,
  CAD: 2,
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  LKR: 'Rs.',
  CAD: '$',
};

export function getCurrencyForCountry(countryCode: string): Currency {
  switch (countryCode) {
    case 'CA': return 'CAD'
    case 'LK': return 'LKR'
    default: return 'LKR'
  }
}
