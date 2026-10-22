import { describe, expect, it } from 'vitest';
import {
  calculateCorrectedAge,
  calculateDecimalAge,
  calculateFullMonthsAge,
  getCorrectedBirthDate,
} from './growth-utils';
import {
  GOLDEN_CORRECTED_AGE_CASES,
  GOLDEN_CORRECTED_BIRTH_CASES,
  GOLDEN_DECIMAL_AGE_CASES,
  type YMD,
} from '../data/golden-date-cases';

// Expectations are fixed in src/data/golden-date-cases.ts and were derived by
// scripts/golden-date-independent-check.ts (integer civil-day arithmetic; no production calculation or date-fns).
// Dates are local calendar days; nothing here calls a production date helper to produce an expected value.
const local = ([y, m, d]: YMD) => new Date(y, m - 1, d);
const ymd = (date: Date | null): YMD | null => (date === null ? null : [date.getFullYear(), date.getMonth() + 1, date.getDate()]);

describe('golden date / age expectations (independent calculation)', () => {
  describe('decimal age: leap-day births, month-end births, leap/non-leap age years, 4-decimal rounding', () => {
    it.each(GOLDEN_DECIMAL_AGE_CASES.map(c => [c.id, c] as const))('%s', (_id, c) => {
      expect(calculateDecimalAge(local(c.birth), local(c.measurement))).toBe(c.expectedAge);
    });

    it('keeps the 4-decimal value on both sides of the rounding tie, as fixed above (not a tolerance check)', () => {
      const below = calculateDecimalAge(local([2021, 1, 1]), local([2021, 2, 9]));
      const above = calculateDecimalAge(local([2021, 1, 1]), local([2021, 4, 18]));
      expect(below).toBe(0.1068);
      expect(above).toBe(0.2932);
    });
  });

  describe('corrected birth date from gestational weeks and days (40w0d = 280 days)', () => {
    it.each(GOLDEN_CORRECTED_BIRTH_CASES.map(c => [c.id, c] as const))('%s', (_id, c) => {
      expect(ymd(getCorrectedBirthDate(local(c.birth), c.weeks, c.days))).toEqual(c.expectedCorrectedBirth);
    });
  });

  describe('corrected age around the 40w0d-equivalent date and the 3.0-year boundary', () => {
    it.each(GOLDEN_CORRECTED_AGE_CASES.map(c => [c.id, c] as const))('%s', (_id, c) => {
      const result = calculateCorrectedAge(local(c.birth), local(c.measurement), c.weeks, c.days);
      if (c.expectedCorrectedAge === null) {
        expect(result).toBeNull();
      } else {
        expect(result).toBe(c.expectedCorrectedAge);
      }
    });

    it('treats corrected age exactly 0 as a valid value, distinct from null (before term-equivalent)', () => {
      const birth = local([2020, 1, 1]);
      expect(calculateCorrectedAge(birth, local([2020, 2, 25]), 32, 0)).toBeNull();
      expect(calculateCorrectedAge(birth, local([2020, 2, 26]), 32, 0)).toBe(0);
    });

    it('distinguishes corrected age 0 from a positive corrected age whose completed month is still 0', () => {
      // 32w0d born 2020-01-01: corrected birth date 2020-02-26 (+56 days).
      const correctedBirth = local([2020, 2, 26]);
      const atCorrectedBirth = local([2020, 2, 26]);
      const lastDayOfMonthZero = local([2020, 3, 25]);
      const firstDayOfMonthOne = local([2020, 3, 26]);

      expect(calculateFullMonthsAge(correctedBirth, atCorrectedBirth)).toBe('満0ヶ月');
      expect(calculateFullMonthsAge(correctedBirth, lastDayOfMonthZero)).toBe('満0ヶ月');
      expect(calculateFullMonthsAge(correctedBirth, firstDayOfMonthOne)).toBe('満1ヶ月');
      // corrected decimal ages (fixed above): 0, 0.0765 (> 0 but month 0), 0.0792 (month 1)
      const birth = local([2020, 1, 1]);
      expect(calculateCorrectedAge(birth, atCorrectedBirth, 32, 0)).toBe(0);
      expect(calculateCorrectedAge(birth, lastDayOfMonthZero, 32, 0)).toBe(0.0765);
      expect(calculateCorrectedAge(birth, firstDayOfMonthOne, 32, 0)).toBe(0.0792);
    });
  });
});
