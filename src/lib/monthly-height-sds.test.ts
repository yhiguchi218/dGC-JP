import { describe, expect, it } from 'vitest';
import { differenceInMonths } from 'date-fns';
import { FUHYO_BOYS_HEIGHT, FUHYO_GIRLS_HEIGHT } from '../data/fuhyo-growth-data';
import { calculateFullMonthsAge, calculateMonthlyHeightSDS, HEIGHT_SDS_MAX_COMPLETED_MONTHS } from './growth-utils';

/*
 * Expected values are hand-calculated as (height - mean) / SD using the reference month, mean and SD
 * written beside each case. The mean/SD are the values currently in src/data/fuhyo-growth-data.ts; these
 * tests check calculation against that table, NOT the table against the original 附表1 PDF.
 */

const birth = new Date(2000, 0, 1);

describe('calculateMonthlyHeightSDS (附表1 completed-month height SDS)', () => {
  it('keeps the infant calculation: boys 0 months mean 49.0 SD 2.1', () => {
    expect(calculateMonthlyHeightSDS(49.0, birth, new Date(2000, 0, 1), FUHYO_BOYS_HEIGHT)).toBeCloseTo(0, 10);
    // (51.1 - 49.0) / 2.1 = +1
    expect(calculateMonthlyHeightSDS(51.1, birth, new Date(2000, 0, 31), FUHYO_BOYS_HEIGHT)).toBeCloseTo(1, 10);
  });

  it('boys 12 months (mean 75.0, SD 2.6): mean -> 0, mean +/- SD -> +/-1', () => {
    const measured = new Date(2001, 0, 1);
    expect(calculateMonthlyHeightSDS(75.0, birth, measured, FUHYO_BOYS_HEIGHT)).toBeCloseTo(0, 10);
    expect(calculateMonthlyHeightSDS(77.6, birth, measured, FUHYO_BOYS_HEIGHT)).toBeCloseTo(1, 10);
    expect(calculateMonthlyHeightSDS(72.4, birth, measured, FUHYO_BOYS_HEIGHT)).toBeCloseTo(-1, 10);
  });

  it('boys 36 months (3y0m, mean 93.3, SD 3.5): (95.0 - 93.3) / 3.5 = 0.485714', () => {
    expect(calculateMonthlyHeightSDS(95.0, birth, new Date(2003, 0, 1), FUHYO_BOYS_HEIGHT)).toBeCloseTo(0.4857142857, 8);
  });

  it('uses the monthly table after 3.0 years (boys 37 months, mean 94.0, SD 3.5: (97.5 - 94.0) / 3.5 = 1)', () => {
    expect(calculateMonthlyHeightSDS(97.5, birth, new Date(2003, 1, 1), FUHYO_BOYS_HEIGHT)).toBeCloseTo(1, 10);
  });

  it('school age: boys 72 months (mean 113.3, SD 4.8): (120.5 - 113.3) / 4.8 = 1.5', () => {
    expect(calculateMonthlyHeightSDS(120.5, birth, new Date(2006, 0, 1), FUHYO_BOYS_HEIGHT)).toBeCloseTo(1.5, 10);
  });

  it('adolescence: boys 144 months (mean 149.1, SD 7.6): (141.5 - 149.1) / 7.6 = -1', () => {
    expect(calculateMonthlyHeightSDS(141.5, birth, new Date(2012, 0, 1), FUHYO_BOYS_HEIGHT)).toBeCloseTo(-1, 10);
  });

  it('selects the table by sex at 144 months: same 150 cm gives 0.9/7.6 (boys) vs 0.4/6.3 (girls, mean 149.6, SD 6.3)', () => {
    const measured = new Date(2012, 0, 1);
    expect(calculateMonthlyHeightSDS(150, birth, measured, FUHYO_BOYS_HEIGHT)).toBeCloseTo(0.9 / 7.6, 10);
    expect(calculateMonthlyHeightSDS(150, birth, measured, FUHYO_GIRLS_HEIGHT)).toBeCloseTo(0.4 / 6.3, 10);
  });

  it('girls 210 months (mean 158.1, SD 5.3): (163.4 - 158.1) / 5.3 = 1', () => {
    expect(calculateMonthlyHeightSDS(163.4, birth, new Date(2017, 6, 1), FUHYO_GIRLS_HEIGHT)).toBeCloseTo(1, 10);
  });

  describe('upper age boundary', () => {
    it('is calculable at 210 months and uses that row until just before 211 months (boys mean 170.8, SD 5.8)', () => {
      expect(HEIGHT_SDS_MAX_COMPLETED_MONTHS).toBe(210);
      // (176.6 - 170.8) / 5.8 = +1
      [new Date(2017, 6, 1), new Date(2017, 6, 15), new Date(2017, 6, 31)].forEach((measured) => {
        expect(differenceInMonths(measured, birth)).toBe(210);
        expect(calculateMonthlyHeightSDS(176.6, birth, measured, FUHYO_BOYS_HEIGHT)).toBeCloseTo(1, 10);
      });
    });

    it('is not calculable at exactly 211 months (17y7m) or later, and never returns 0 for that', () => {
      [new Date(2017, 7, 1), new Date(2018, 0, 1), new Date(2030, 0, 1)].forEach((measured) => {
        expect(calculateMonthlyHeightSDS(170.8, birth, measured, FUHYO_BOYS_HEIGHT)).toBeNull();
        expect(calculateMonthlyHeightSDS(170.8, birth, measured, FUHYO_GIRLS_HEIGHT)).toBeNull();
      });
    });

    it('does not interpolate between months: the whole of month 36 uses the same row', () => {
      const first = calculateMonthlyHeightSDS(95, birth, new Date(2003, 0, 1), FUHYO_BOYS_HEIGHT);
      const last = calculateMonthlyHeightSDS(95, birth, new Date(2003, 0, 31), FUHYO_BOYS_HEIGHT);
      expect(first).toBe(last);
    });
  });

  describe('month-end and leap-day boundaries follow the existing date-fns completed-month policy', () => {
    const cases: Array<[string, Date, Date, number]> = [
      ['Jan 31 -> Feb 29 (leap year) is 1 month', new Date(2020, 0, 31), new Date(2020, 1, 29), 1],
      ['Jan 31 -> Mar 30 is still 1 month', new Date(2020, 0, 31), new Date(2020, 2, 30), 1],
      ['Jan 31 -> Mar 31 is 2 months', new Date(2020, 0, 31), new Date(2020, 2, 31), 2],
      ['Feb 29 birth -> Feb 28 next year is 12 months', new Date(2020, 1, 29), new Date(2021, 1, 28), 12],
      ['Feb 29 birth -> Feb 29 four years later is 48 months', new Date(2020, 1, 29), new Date(2024, 1, 29), 48],
      ['Jan 31 birth -> Jul 30 (age 17) is 209 months', new Date(2000, 0, 31), new Date(2017, 6, 30), 209],
      ['Jan 31 birth -> Jul 31 (age 17) is 210 months', new Date(2000, 0, 31), new Date(2017, 6, 31), 210],
      ['Jan 31 birth -> Aug 30 (age 17) is still 210 months', new Date(2000, 0, 31), new Date(2017, 7, 30), 210],
    ];

    it.each(cases)('%s', (_label, from, to, months) => {
      expect(differenceInMonths(to, from)).toBe(months);
      // The result must come from exactly the table row for that month.
      const [mean, sd] = FUHYO_BOYS_HEIGHT[months];
      expect(calculateMonthlyHeightSDS(mean + sd, from, to, FUHYO_BOYS_HEIGHT)).toBeCloseTo(1, 10);
    });

    it('Jan 31 birth -> Aug 31 (age 17) reaches 211 months and is not calculable', () => {
      const from = new Date(2000, 0, 31);
      const to = new Date(2017, 7, 31);
      expect(differenceInMonths(to, from)).toBe(211);
      expect(calculateMonthlyHeightSDS(170.8, from, to, FUHYO_BOYS_HEIGHT)).toBeNull();
    });

    it('agrees with the displayed completed months', () => {
      expect(calculateFullMonthsAge(new Date(2000, 0, 31), new Date(2017, 7, 30))).toBe('満17歳6ヶ月');
      expect(calculateFullMonthsAge(new Date(2000, 0, 31), new Date(2017, 7, 31))).toBe('満17歳7ヶ月');
    });
  });

  describe('safe handling of invalid inputs', () => {
    it('returns null for a measurement before the (reference) birth date', () => {
      expect(calculateMonthlyHeightSDS(50, new Date(2020, 0, 29), new Date(2020, 0, 28), FUHYO_BOYS_HEIGHT)).toBeNull();
      expect(calculateMonthlyHeightSDS(50, new Date(2020, 0, 29), new Date(2019, 0, 1), FUHYO_BOYS_HEIGHT)).toBeNull();
    });

    it('is calculable on the same day (month 0) and the next day, but not the day before', () => {
      const ref = new Date(2020, 0, 29);
      // boys month 0: mean 49.0, SD 2.1 -> (51.1 - 49.0) / 2.1 = +1
      expect(calculateMonthlyHeightSDS(51.1, ref, new Date(2020, 0, 29), FUHYO_BOYS_HEIGHT)).toBeCloseTo(1, 10);
      expect(calculateMonthlyHeightSDS(51.1, ref, new Date(2020, 0, 30), FUHYO_BOYS_HEIGHT)).toBeCloseTo(1, 10);
      expect(calculateMonthlyHeightSDS(51.1, ref, new Date(2020, 0, 28), FUHYO_BOYS_HEIGHT)).toBeNull();
    });

    it('returns null for a measurement far before the reference birth date', () => {
      expect(calculateMonthlyHeightSDS(51.1, new Date(2020, 0, 29), new Date(2010, 0, 1), FUHYO_BOYS_HEIGHT)).toBeNull();
    });

    it('returns null for invalid dates', () => {
      expect(calculateMonthlyHeightSDS(50, new Date(Number.NaN), new Date(2020, 0, 1), FUHYO_BOYS_HEIGHT)).toBeNull();
      expect(calculateMonthlyHeightSDS(50, birth, new Date(Number.NaN), FUHYO_BOYS_HEIGHT)).toBeNull();
    });

    it.each([Number.NaN, Infinity, -Infinity])('returns null for a non-finite height: %s', (height) => {
      expect(calculateMonthlyHeightSDS(height, birth, new Date(2003, 0, 1), FUHYO_BOYS_HEIGHT)).toBeNull();
    });

    it('returns null when the table has no row for the month', () => {
      expect(calculateMonthlyHeightSDS(50, birth, new Date(2000, 5, 1), [[49, 2.1]])).toBeNull();
      expect(calculateMonthlyHeightSDS(50, birth, new Date(2000, 0, 1), [])).toBeNull();
    });

    it.each([
      ['NaN mean', [Number.NaN, 2.1]],
      ['Infinity mean', [Infinity, 2.1]],
      ['NaN SD', [49, Number.NaN]],
      ['Infinity SD', [49, Infinity]],
      ['zero SD', [49, 0]],
      ['negative SD', [49, -2.1]],
    ] as Array<[string, [number, number]]>)('returns null for an invalid reference (%s)', (_label, row) => {
      expect(calculateMonthlyHeightSDS(50, birth, new Date(2000, 0, 1), [row])).toBeNull();
    });

    it('does not fall back to another source when the table is unusable', () => {
      expect(calculateMonthlyHeightSDS(95, birth, new Date(2003, 0, 1), [])).toBeNull();
    });
  });
});
