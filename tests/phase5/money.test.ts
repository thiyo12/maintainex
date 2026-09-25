import { describe, it, expect } from 'vitest';
import {
  createMoney,
  lkrCents,
  lkrRupees,
  legacyToMinorUnits,
  parseMajorUnitsInput,
  hasFractionalParts,
  toMinorUnitsSafe,
  minorUnitsToDisplay,
  minorUnitsToMajorUnits,
  formatMoneyForApi,
  parseMoneyFromApi,
  addMoney,
  subtractMoney,
  multiplyMoney,
  divideMoney,
  computeCommission,
  computeCommissionFromBps,
  moneyEquals,
  moneyGreaterThan,
  moneyGreaterThanOrEqual,
  moneyIsZero,
  validatePositive,
  validateNonNegative,
  ZERO_LKR,
} from '@/lib/money';

describe('Money Utility', () => {
  describe('createMoney', () => {
    it('creates money from bigint', () => {
      const m = createMoney(500000n);
      expect(m.amount).toBe(500000n);
      expect(m.currency).toBe('LKR');
    });

    it('rejects negative amount', () => {
      expect(() => createMoney(-1n)).toThrow('cannot be negative');
    });
  });

  describe('lkrCents', () => {
    it('creates LKR from cents', () => {
      const m = lkrCents(500000);
      expect(m.amount).toBe(500000n);
    });

    it('rounds number to integer', () => {
      const m = lkrCents(500000.7);
      expect(m.amount).toBe(500001n);
    });
  });

  describe('lkrRupees', () => {
    it('converts rupees to cents', () => {
      const m = lkrRupees(5000);
      expect(m.amount).toBe(500000n);
    });

    it('handles decimal rupees', () => {
      const m = lkrRupees(5000.50);
      expect(m.amount).toBe(500050n);
    });

    it('parses string input', () => {
      const m = lkrRupees('5000');
      expect(m.amount).toBe(500000n);
    });
  });

  describe('parseMajorUnitsInput', () => {
    it('converts a mobile LKR quote of 5000 to canonical 500000 minor units', () => {
      expect(parseMajorUnitsInput(5000, 'LKR')).toBe(500000n)
      expect(parseMajorUnitsInput('5000.50', 'LKR')).toBe(500050n)
    })

    it('rejects invalid or over-precise major-unit values', () => {
      expect(parseMajorUnitsInput(0, 'LKR')).toBeNull()
      expect(parseMajorUnitsInput('-1', 'LKR')).toBeNull()
      expect(parseMajorUnitsInput('12.345', 'LKR')).toBeNull()
      expect(parseMajorUnitsInput('abc', 'LKR')).toBeNull()
    })
  })

  describe('legacyToMinorUnits', () => {
    it('converts whole number', () => {
      expect(legacyToMinorUnits(5000)).toBe(500000n);
    });

    it('converts zero', () => {
      expect(legacyToMinorUnits(0)).toBe(0n);
    });

    it('rounds fractional', () => {
      expect(legacyToMinorUnits(5000.5)).toBe(500050n);
    });

    it('rejects negative', () => {
      expect(() => legacyToMinorUnits(-1)).toThrow('cannot be negative');
    });

    it('rejects NaN', () => {
      expect(() => legacyToMinorUnits(NaN)).toThrow('must be finite');
    });

    it('rejects Infinity', () => {
      expect(() => legacyToMinorUnits(Infinity)).toThrow('must be finite');
    });
  });

  describe('hasFractionalParts', () => {
    it('returns false for whole number', () => {
      expect(hasFractionalParts(5000)).toBe(false);
    });

    it('returns true for fractional cents', () => {
      expect(hasFractionalParts(5000.123)).toBe(true);
    });

    it('returns false for zero', () => {
      expect(hasFractionalParts(0)).toBe(false);
    });
  });

  describe('toMinorUnitsSafe', () => {
    it('converts whole number', () => {
      expect(toMinorUnitsSafe(5000)).toBe(500000n);
    });

    it('rejects fractional cents', () => {
      expect(() => toMinorUnitsSafe(5000.123)).toThrow('Fractional value');
    });
  });

  describe('minorUnitsToDisplay', () => {
    it('formats whole amount', () => {
      expect(minorUnitsToDisplay(500000n)).toBe('Rs. 5,000');
    });

    it('formats zero', () => {
      expect(minorUnitsToDisplay(0n)).toBe('Rs. 0');
    });
  });

  describe('minorUnitsToMajorUnits', () => {
    it('converts back to major units', () => {
      expect(minorUnitsToMajorUnits(500000n)).toBe(5000);
    });

    it('handles fractional cents', () => {
      expect(minorUnitsToMajorUnits(50050n)).toBe(500.5);
    });
  });

  describe('API serialization', () => {
    it('formatMoneyForApi returns string', () => {
      expect(formatMoneyForApi(500000n)).toBe('500000');
    });

    it('parseMoneyFromApi parses valid string', () => {
      const m = parseMoneyFromApi('500000');
      expect(m.amount).toBe(500000n);
    });

    it('rejects invalid string', () => {
      expect(() => parseMoneyFromApi('abc')).toThrow('Invalid money string');
    });
  });

  describe('Arithmetic', () => {
    it('adds same currency', () => {
      const a = lkrCents(100);
      const b = lkrCents(200);
      expect(addMoney(a, b).amount).toBe(300n);
    });

    it('rejects adding different currencies', () => {
      const a = lkrCents(100);
      const b = { amount: 200n, currency: 'USD' as any };
      expect(() => addMoney(a, b)).toThrow('different currencies');
    });

    it('subtracts same currency', () => {
      const a = lkrCents(300);
      const b = lkrCents(100);
      expect(subtractMoney(a, b).amount).toBe(200n);
    });

    it('rejects insufficient funds', () => {
      const a = lkrCents(100);
      const b = lkrCents(200);
      expect(() => subtractMoney(a, b)).toThrow('Insufficient funds');
    });

    it('multiplies', () => {
      const a = lkrCents(100);
      expect(multiplyMoney(a, 3).amount).toBe(300n);
    });

    it('divides', () => {
      const a = lkrCents(300);
      expect(divideMoney(a, 3n)).toBe(100n);
    });
  });

  describe('Commission', () => {
    it('computes 10% commission', () => {
      expect(computeCommission(100000n, 10)).toBe(10000n);
    });

    it('computes 15% commission', () => {
      expect(computeCommission(100000n, 15)).toBe(15000n);
    });

    it('computes from basis points', () => {
      expect(computeCommissionFromBps(100000n, 1000n)).toBe(10000n);
    });
  });

  describe('Comparison', () => {
    it('equality', () => {
      expect(moneyEquals(lkrCents(100), lkrCents(100))).toBe(true);
      expect(moneyEquals(lkrCents(100), lkrCents(200))).toBe(false);
    });

    it('greater than', () => {
      expect(moneyGreaterThan(lkrCents(200), lkrCents(100))).toBe(true);
      expect(moneyGreaterThan(lkrCents(100), lkrCents(200))).toBe(false);
    });

    it('greater than or equal', () => {
      expect(moneyGreaterThanOrEqual(lkrCents(100), lkrCents(100))).toBe(true);
      expect(moneyGreaterThanOrEqual(lkrCents(200), lkrCents(100))).toBe(true);
    });

    it('isZero', () => {
      expect(moneyIsZero(ZERO_LKR)).toBe(true);
      expect(moneyIsZero(lkrCents(1))).toBe(false);
    });
  });

  describe('Validation', () => {
    it('validatePositive accepts positive', () => {
      expect(() => validatePositive(lkrCents(1))).not.toThrow();
    });

    it('validatePositive rejects zero', () => {
      expect(() => validatePositive(ZERO_LKR)).toThrow('must be positive');
    });

    it('validateNonNegative accepts zero', () => {
      expect(() => validateNonNegative(ZERO_LKR)).not.toThrow();
    });
  });
});
