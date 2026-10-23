import { describe, expect, it } from 'vitest';
import { evaluateMeasurement, type MeasurementEvaluationContext } from './measurement-evaluation';
import { FUHYO_BOYS_HEIGHT, FUHYO_GIRLS_HEIGHT } from '../data/fuhyo-growth-data';
import { WEIGHT_BOYS_LMS, WEIGHT_GIRLS_LMS } from '../data/growth-data';
import { ACHONDROPLASIA_CLARITY_CSV_ROWS } from '../data/achondroplasia-clarity-source-fixture';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

// Expected SDS values use the original CSV cells (via the source fixture) and plain arithmetic.
const csv = (sex: 0 | 1, month: number) => {
  const row = ACHONDROPLASIA_CLARITY_CSV_ROWS.find(r => r[0] === sex && r[1] === month);
  if (!row) throw new Error(`no CSV row for sex ${sex} month ${month}`);
  const [, , htMean, htSd, wtMean, wtLower, wtUpper] = row;
  return { htMean, htSd, wtMean, wtLower, wtUpper };
};
const expectedHeightSDS = (sex: 0 | 1, month: number, height: number) => {
  const { htMean, htSd } = csv(sex, month);
  return (height - htMean) / htSd;
};
const expectedWeightSDS = (sex: 0 | 1, month: number, weight: number) => {
  const { wtMean, wtLower, wtUpper } = csv(sex, month);
  if (weight === wtMean) return 0;
  return weight > wtMean ? (weight - wtMean) / wtUpper : (weight - wtMean) / wtLower;
};

const ctx = (overrides: Partial<MeasurementEvaluationContext> = {}): MeasurementEvaluationContext => ({
  growthReference: 'achondroplasia-clarity',
  birthDate: d(2020, 1, 1),
  sexKey: 'male',
  gestationalWeeks: 40,
  gestationalDays: 0,
  fuhyoHeightTable: FUHYO_BOYS_HEIGHT,
  weightTable: WEIGHT_BOYS_LMS,
  ...overrides,
});
const evalOne = (date: Date, height: number | string | undefined, weight: number | string | undefined, c = ctx()) => {
  const result = evaluateMeasurement({ id: 'm', date, height, weight }, c);
  if (!result) throw new Error('evaluation returned null');
  return result;
};

describe('evaluateMeasurement: achondroplasia (CLARITY) reference', () => {
  it('calculates height and weight SDS from the completed-month CLARITY row and reports no Japanese-only values', () => {
    // Born 2020-01-01, measured 2021-01-01: exactly 12 completed months.
    const r = evalOne(d(2021, 1, 1), 71.9, 9.15);
    expect(r.growthReference).toBe('achondroplasia-clarity');
    expect(r.heightSDS).toBeCloseTo(3.07653137549157, 9); // fixed value from the CSV row (male, month 12)
    expect(r.weightSDS).toBeCloseTo(1.49764778590863, 9);
    expect(r.heightSDS).toBeCloseTo(expectedHeightSDS(0, 12, 71.9), 12);
    expect(r.weightSDS).toBeCloseTo(expectedWeightSDS(0, 12, 9.15), 12);
    expect(r.isHeightSDSOutOfRange).toBe(false);
    expect(r.isWeightSDSOutOfRange).toBe(false);
    expect(r.isHeightSDSUnavailable).toBe(false);
    expect(r.isWeightSDSUnavailable).toBe(false);
    expect(r.height).toBe(71.9);
    expect(r.weight).toBe(9.15);
    expect(r.bmi).toBeUndefined();
    expect(r.obesityIndex).toBeNull();
    expect(r.obesityIndexAge).toBeNull();
    expect(r.weightSDSReferenceLimitAge).toBeNull();
  });

  it('uses the girls table for female', () => {
    const r = evalOne(d(2025, 1, 1), 97.05, 18.39, ctx({ sexKey: 'female', fuhyoHeightTable: FUHYO_GIRLS_HEIGHT, weightTable: WEIGHT_GIRLS_LMS }));
    expect(r.heightSDS).toBeCloseTo(2.18564577473808, 9); // female, month 60
    expect(r.weightSDS).toBeCloseTo(1.50208316001434, 9);
  });

  it('gives the same SDS for the same completed month and the same value', () => {
    // 2020-06-01 and 2020-06-30 are both 5 completed months after 2020-01-01.
    const a = evalOne(d(2020, 6, 1), 65, 7);
    const b = evalOne(d(2020, 6, 30), 65, 7);
    expect(a.heightSDS).toBe(b.heightSDS);
    expect(a.weightSDS).toBe(b.weightSDS);
    expect(a.heightSDS).toBeCloseTo(expectedHeightSDS(0, 5, 65), 12);
    // The next completed month uses another row.
    expect(evalOne(d(2020, 7, 1), 65, 7).heightSDS).toBeCloseTo(expectedHeightSDS(0, 6, 65), 12);
  });

  it('keeps an SDS of exactly 0 (height or weight equal to the mean) as a valid value', () => {
    const { htMean, wtMean } = csv(0, 12);
    const r = evalOne(d(2021, 1, 1), htMean, wtMean);
    expect(r.heightSDS).toBe(0);
    expect(r.weightSDS).toBe(0);
    expect(r.isHeightSDSUnavailable).toBe(false);
    expect(r.isWeightSDSUnavailable).toBe(false);
  });

  it('evaluates height only or weight only without touching the other indicator', () => {
    const heightOnly = evalOne(d(2021, 1, 1), 71.9, undefined);
    expect(heightOnly.heightSDS).toBeDefined();
    expect(heightOnly.weightSDS).toBeUndefined();
    expect(heightOnly.isWeightSDSUnavailable).toBe(false);
    const weightOnly = evalOne(d(2021, 1, 1), undefined, 9.15);
    expect(weightOnly.weightSDS).toBeDefined();
    expect(weightOnly.heightSDS).toBeUndefined();
    expect(weightOnly.isHeightSDSUnavailable).toBe(false);
  });

  it('keeps invalid input separate: no SDS, no "unavailable" flag, input text retained', () => {
    const r = evalOne(d(2021, 1, 1), 'abc', -3);
    expect(r.isHeightInvalid).toBe(true);
    expect(r.isWeightInvalid).toBe(true);
    expect(r.heightSDS).toBeUndefined();
    expect(r.weightSDS).toBeUndefined();
    expect(r.isHeightSDSUnavailable).toBe(false);
    expect(r.isWeightSDSUnavailable).toBe(false);
    expect(r.heightInputText).toBe('abc');
  });

  describe('age limit: 0 through exactly 18.0 years', () => {
    const c = ctx({ birthDate: d(2002, 1, 1) });

    it('calculates at exactly 18.0 years from the 216-month row', () => {
      const r = evalOne(d(2020, 1, 1), 139, 75.25, c);
      expect(r.age).toBe(18);
      expect(r.heightSDS).toBeCloseTo(1.5994916456939, 9);
      expect(r.weightSDS).toBeCloseTo(1.49973606098998, 9);
      expect(r.isHeightSDSOutOfRange).toBe(false);
    });

    it('does not calculate the next day, keeps the measured values, and never uses the last row', () => {
      const r = evalOne(d(2020, 1, 2), 139, 75.25, c);
      expect(r.heightSDS).toBeUndefined();
      expect(r.weightSDS).toBeUndefined();
      expect(r.isHeightSDSOutOfRange).toBe(true);
      expect(r.isWeightSDSOutOfRange).toBe(true);
      expect(r.isHeightSDSUnavailable).toBe(false);
      expect(r.height).toBe(139);
      expect(r.weight).toBe(75.25);
    });

    it('flags only the indicator that has a value', () => {
      const r = evalOne(d(2020, 1, 2), 139, undefined, c);
      expect(r.isHeightSDSOutOfRange).toBe(true);
      expect(r.isWeightSDSOutOfRange).toBe(false);
    });
  });

  describe('corrected age (application policy, unchanged)', () => {
    // 30w0d is 70 days short of 40w0d: corrected birth date 2020-03-11 for a 2020-01-01 birth.
    const preterm = ctx({ gestationalWeeks: 30, gestationalDays: 0 });

    it('accepts a corrected age of exactly 0 and uses the corrected birth date for the row', () => {
      const r = evalOne(d(2020, 3, 11), 50, 3.3, preterm);
      expect(r.correctedAge).toBe(0);
      expect(r.showCorrected).toBe(true);
      expect(r.isStandardEvaluationHeld).toBe(false);
      // Corrected: month 0. (Chronological would be month 2.)
      expect(r.heightSDS).toBeCloseTo(expectedHeightSDS(0, 0, 50), 12);
      expect(r.heightSDS).not.toBeCloseTo(expectedHeightSDS(0, 2, 50), 3);
      expect(r.weightSDS).toBeCloseTo(expectedWeightSDS(0, 0, 3.3), 12);
    });

    it('holds the evaluation before the 40-week equivalent, with no SDS and no unavailable flag', () => {
      const r = evalOne(d(2020, 3, 10), 50, 3.3, preterm);
      expect(r.isPretermBeforeCorrection).toBe(true);
      expect(r.isStandardEvaluationHeld).toBe(true);
      expect(r.heightSDS).toBeUndefined();
      expect(r.weightSDS).toBeUndefined();
      expect(r.isHeightSDSUnavailable).toBe(false);
      expect(r.isWeightSDSUnavailable).toBe(false);
      expect(r.isHeightSDSOutOfRange).toBe(false);
    });

    it('advances the row by corrected months', () => {
      // 2020-04-11 is 1 corrected month (and 3 chronological months).
      const r = evalOne(d(2020, 4, 11), 55, 4.5, preterm);
      expect(r.heightSDS).toBeCloseTo(expectedHeightSDS(0, 1, 55), 12);
      expect(r.weightSDS).toBeCloseTo(expectedWeightSDS(0, 1, 4.5), 12);
    });

    it('applies the correction through exactly 3.0 years and not after', () => {
      const at3 = evalOne(d(2023, 1, 1), 95, 14, preterm);
      expect(at3.age).toBe(3);
      expect(at3.showCorrected).toBe(true);
      expect(at3.heightSDS).toBeCloseTo(expectedHeightSDS(0, 33, 95), 12); // corrected months: 2020-03-11 -> 2023-01-01
      expect(at3.weightSDS).toBeCloseTo(expectedWeightSDS(0, 33, 14), 12);

      const after = evalOne(d(2023, 1, 2), 95, 14, preterm);
      expect(after.showCorrected).toBe(false);
      expect(after.heightSDS).toBeCloseTo(expectedHeightSDS(0, 36, 95), 12); // chronological months
      expect(after.weightSDS).toBeCloseTo(expectedWeightSDS(0, 36, 14), 12);
    });

    it.each([
      { label: 'days 7', weeks: 30, days: 7 },
      { label: 'days NaN', weeks: 30, days: Number.NaN },
      { label: 'days 2.5', weeks: 30, days: 2.5 },
      { label: 'days -1', weeks: 30, days: -1 },
      { label: 'weeks NaN', weeks: Number.NaN, days: 0 },
    ])('holds the evaluation for invalid gestational information within 3.0 years ($label) and never treats it as 0', ({ weeks, days }) => {
      const r = evalOne(d(2021, 1, 1), 71.9, 9.15, ctx({ gestationalWeeks: weeks, gestationalDays: days }));
      expect(r.isGestationalEvaluationPending).toBe(true);
      expect(r.isStandardEvaluationHeld).toBe(true);
      expect(r.showCorrected).toBe(false);
      expect(r.heightSDS).toBeUndefined();
      expect(r.weightSDS).toBeUndefined();
    });

    it('does not hold or correct beyond 3.0 years when the gestational information is invalid', () => {
      const r = evalOne(d(2024, 1, 1), 100, 15, ctx({ gestationalWeeks: 30, gestationalDays: 7 }));
      expect(r.isStandardEvaluationHeld).toBe(false);
      expect(r.showCorrected).toBe(false);
      expect(r.heightSDS).toBeCloseTo(expectedHeightSDS(0, 48, 100), 12);
    });
  });

  it('leaves the Japanese result unchanged when the reference is omitted or explicitly Japanese', () => {
    const base = { birthDate: d(2020, 1, 1), sexKey: 'male' as const, gestationalWeeks: 40, gestationalDays: 0, fuhyoHeightTable: FUHYO_BOYS_HEIGHT, weightTable: WEIGHT_BOYS_LMS };
    const m = { id: 'j', date: d(2021, 1, 1), height: 75, weight: 9.5 };
    const omitted = evaluateMeasurement(m, base);
    const explicit = evaluateMeasurement(m, { ...base, growthReference: 'japanese' });
    expect(omitted).toEqual(explicit);
    expect(omitted?.growthReference).toBe('japanese');
    const [mean, sd] = FUHYO_BOYS_HEIGHT[12];
    expect(omitted?.heightSDS).toBeCloseTo((75 - mean) / sd, 10);
    expect(omitted?.bmi).toBeCloseTo(9.5 / (0.75 * 0.75), 10);
    expect(omitted?.obesityIndex).toBeCloseTo(1.38957, 4);
    expect(omitted?.isWeightSDSOutOfRange).toBe(false);
    expect(omitted?.isWeightSDSUnavailable).toBe(false);

    // Same measurement, other reference: a different SDS and no BMI.
    const achondroplasia = evaluateMeasurement(m, { ...base, growthReference: 'achondroplasia-clarity' });
    expect(achondroplasia?.heightSDS).not.toBeCloseTo(omitted?.heightSDS ?? 0, 1);
    expect(achondroplasia?.bmi).toBeUndefined();
  });
});
