export type Currency = 'LKR' | 'CAD';

export const CURRENCY_EXPONENTS: Record<Currency, number> = {
  LKR: 2,
  CAD: 2,
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  LKR: 'Rs.',
  CAD: '$',
};

export const CURRENCY_NAMES: Record<Currency, string> = {
  LKR: 'Sri Lankan Rupee',
  CAD: 'Canadian Dollar',
};

export interface MoneyAmount {
  readonly amount: bigint;
  readonly currency: Currency;
}

export function createMoney(amount: bigint, currency: Currency = 'LKR'): MoneyAmount {
  if (amount < 0n) {
    throw new Error('Money amount cannot be negative');
  }
  return { amount, currency };
}

export function lkrCents(cents: number | bigint): MoneyAmount {
  const bigintValue = typeof cents === 'number' ? BigInt(Math.round(cents)) : cents;
  if (bigintValue < 0n) {
    throw new Error('LKR amount cannot be negative');
  }
  return { amount: bigintValue, currency: 'LKR' };
}

export function lkrRupees(rupees: number | string): MoneyAmount {
  const num = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (Number.isNaN(num)) {
    throw new Error('Invalid LKR amount');
  }
  if (num < 0) {
    throw new Error('LKR amount cannot be negative');
  }
  const cents = Math.round(num * 100);
  return { amount: BigInt(cents), currency: 'LKR' };
}

export function legacyToMinorUnits(legacyAmount: number, currency: Currency = 'LKR'): bigint {
  if (!Number.isFinite(legacyAmount)) {
    throw new Error('Legacy amount must be finite');
  }
  if (legacyAmount < 0) {
    throw new Error('Legacy amount cannot be negative');
  }
  const exponent = CURRENCY_EXPONENTS[currency];
  const scaled = Math.round(legacyAmount * Math.pow(10, exponent));
  return BigInt(scaled);
}

export function hasFractionalParts(legacyAmount: number, currency: Currency = 'LKR'): boolean {
  if (!Number.isFinite(legacyAmount)) {
    return true;
  }
  const exponent = CURRENCY_EXPONENTS[currency];
  const scaled = legacyAmount * Math.pow(10, exponent);
  return scaled !== Math.round(scaled);
}

export function toMinorUnitsSafe(legacyAmount: number, currency: Currency = 'LKR'): bigint {
  if (hasFractionalParts(legacyAmount, currency)) {
    throw new Error(`Fractional value detected in legacy amount ${legacyAmount} — cannot safely convert`);
  }
  return legacyToMinorUnits(legacyAmount, currency);
}

export function minorUnitsToDisplay(cents: bigint, currency: Currency = 'LKR'): string {
  const exponent = CURRENCY_EXPONENTS[currency];
  const divisor = BigInt(10 ** exponent);
  const whole = cents / divisor;
  const fraction = cents % divisor;
  if (fraction === 0n) {
    return `${CURRENCY_SYMBOLS[currency]} ${whole.toLocaleString()}`;
  }
  const fractionStr = fraction.toString().padStart(exponent, '0').replace(/0+$/, '');
  return `${CURRENCY_SYMBOLS[currency]} ${whole.toLocaleString()}.${fractionStr}`;
}

export function minorUnitsToMajorUnits(cents: bigint, currency: Currency = 'LKR'): number {
  const exponent = CURRENCY_EXPONENTS[currency];
  const divisor = BigInt(10 ** exponent);
  const whole = Number(cents / divisor);
  const fraction = Number(cents % divisor);
  return whole + fraction / Math.pow(10, exponent);
}

export function formatMoneyForApi(cents: bigint): string {
  return cents.toString();
}

export function parseMoneyFromApi(amountStr: string, currency: Currency = 'LKR'): MoneyAmount {
  if (!/^-?\d+$/.test(amountStr)) {
    throw new Error(`Invalid money string: ${amountStr}`);
  }
  const amount = BigInt(amountStr);
  if (amount < 0n) {
    throw new Error('Money amount cannot be negative');
  }
  return { amount, currency };
}

export function formatMoneyForDb(cents: bigint): bigint {
  return cents;
}

export function addMoney(a: MoneyAmount, b: MoneyAmount): MoneyAmount {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add different currencies: ${a.currency} + ${b.currency}`);
  }
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function subtractMoney(a: MoneyAmount, b: MoneyAmount): MoneyAmount {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot subtract different currencies: ${a.currency} - ${b.currency}`);
  }
  const result = a.amount - b.amount;
  if (result < 0n) {
    throw new Error('Insufficient funds');
  }
  return { amount: result, currency: a.currency };
}

export function multiplyMoney(a: MoneyAmount, factor: number | bigint): MoneyAmount {
  const bigFactor = typeof factor === 'number' ? BigInt(Math.round(factor)) : factor;
  return { amount: a.amount * bigFactor, currency: a.currency };
}

export function divideMoney(a: MoneyAmount, divisor: bigint): bigint {
  if (divisor === 0n) {
    throw new Error('Cannot divide by zero');
  }
  return a.amount / divisor;
}

export function computeCommission(grossAmount: bigint, ratePercent: number): bigint {
  const rateBps = BigInt(Math.round(ratePercent * 100));
  return (grossAmount * rateBps) / 10000n;
}

export function computeCommissionFromBps(grossAmount: bigint, rateBps: bigint): bigint {
  return (grossAmount * rateBps) / 10000n;
}

export function moneyEquals(a: MoneyAmount, b: MoneyAmount): boolean {
  return a.amount === b.amount && a.currency === b.currency;
}

export function moneyGreaterThan(a: MoneyAmount, b: MoneyAmount): boolean {
  if (a.currency !== b.currency) {
    throw new Error('Cannot compare different currencies');
  }
  return a.amount > b.amount;
}

export function moneyGreaterThanOrEqual(a: MoneyAmount, b: MoneyAmount): boolean {
  if (a.currency !== b.currency) {
    throw new Error('Cannot compare different currencies');
  }
  return a.amount >= b.amount;
}

export function moneyIsZero(a: MoneyAmount): boolean {
  return a.amount === 0n;
}

export function validatePositive(a: MoneyAmount): void {
  if (a.amount <= 0n) {
    throw new Error('Amount must be positive');
  }
}

export function validateNonNegative(a: MoneyAmount): void {
  if (a.amount < 0n) {
    throw new Error('Amount must be non-negative');
  }
}

export function serializeMoney(cents: bigint): string {
  return cents.toString();
}

export function deserializeMoney(str: string): bigint {
  if (!/^-?\d+$/.test(str)) {
    throw new Error(`Cannot deserialize money: ${str}`);
  }
  return BigInt(str);
}

export function jsonSerializeMoney(cents: bigint): string {
  return cents.toString();
}

export function jsonDeserializeMoney(str: string): bigint {
  if (typeof str !== 'string' || !/^-?\d+$/.test(str)) {
    throw new Error(`Invalid JSON money value: ${str}`);
  }
  return BigInt(str);
}

export function bigIntToSafeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`LEGACY_COMPATIBILITY: BigInt value ${value} exceeds Number.MAX_SAFE_INTEGER — precision would be lost`);
  }
  if (value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error(`LEGACY_COMPATIBILITY: BigInt value ${value} below Number.MIN_SAFE_INTEGER — precision would be lost`);
  }
  const num = Number(value);
  if (BigInt(Math.round(num)) !== value) {
    throw new Error(`LEGACY_COMPATIBILITY: BigInt value ${value} cannot be exactly represented as Number`);
  }
  return num;
}

export const ZERO_LKR: MoneyAmount = { amount: 0n, currency: 'LKR' };
export const ZERO_CAD: MoneyAmount = { amount: 0n, currency: 'CAD' };

export function getCurrencyForCountry(countryCode: string): Currency {
  switch (countryCode) {
    case 'CA': return 'CAD'
    case 'LK': return 'LKR'
    default: return 'LKR'
  }
}
