import { describe, it, expect } from 'vitest';
import { evaluateMeasurement, MeasurementEvaluationContext } from './measurement-evaluation';
import { FUHYO_BOYS_HEIGHT } from '../data/fuhyo-growth-data';
import { WEIGHT_BOYS_LMS } from '../data/growth-data';
import { GOLDEN_OBESITY_CASES } from '../data/golden-obesity-cases';

const makeContext = (overrides: Partial<MeasurementEvaluationContext> = {}): MeasurementEvaluationContext => ({
  birthDate: new Date(2020, 0, 1),
  sexKey: 'male',
  gestationalWeeks: 40,
  gestationalDays: 0,
  fuhyoHeightTable: FUHYO_BOYS_HEIGHT,
  weightTable: WEIGHT_BOYS_LMS,
  ...overrides,
});

describe('evaluateMeasurement', () => {
  it('evaluates a valid term measurement', () => {
    const result = evaluateMeasurement({ id: 'a', date: new Date(2021, 0, 1), height: 75, weight: 9.5 }, makeContext());
    const [mean, sd] = FUHYO_BOYS_HEIGHT[12];

    expect(result).not.toBeNull();
    expect(result?.isStandardEvaluationHeld).toBe(false);
    expect(result?.heightSDS).toBeCloseTo((75 - mean) / sd, 10);
    expect(result?.weightSDS).toBeDefined();
    expect(result?.bmi).toBeCloseTo(9.5 / (0.75 * 0.75), 10);
    // Age is exactly 1.0. Preschool polynomial (70 <= h < 120): 0.00206*75^2 - 0.1166*75 + 6.5273 = 9.3698 kg,
    // so (9.5 - 9.3698) / 9.3698 * 100 = 1.38957 (same arithmetic as the C5 golden comment).
    expect(result?.age).toBe(1);
    expect(result?.obesityIndex).toBeCloseTo(1.38957, 4);
    // The age-specific method applies only from completed age 5, so it is null at age 1.0.
    expect(result?.obesityIndexAge).toBeNull();
  });

  it('applies the age-specific obesity index within its age range (fixture case)', () => {
    const fixture = GOLDEN_OBESITY_CASES.find(c => c.id === 'age-specific boys row 11: 150 cm');
    if (!fixture || fixture.expectedIndex === null) {
  throw new Error('年齢別肥満度の数値期待値を持つfixtureが必要です');
}

    // Born 2020-01-01, measured 2031-07-01: completed age 11 (row 11), as in the fixture's 11.5 y case.
    const result = evaluateMeasurement(
      { id: 'o', date: new Date(2031, 6, 1), height: fixture.height, weight: fixture.weight },
      makeContext()
    );

    expect(Math.floor(result?.age ?? -1)).toBe(11);
    expect(result?.obesityIndexAge).toBeCloseTo(fixture.expectedIndex, 8);
    // School-age height-specific polynomial (149 <= h < 184), hand-computed: standard 40.630625 kg,
    // (50 - 40.630625) / 40.630625 * 100 = 23.05988.
    expect(result?.obesityIndex).toBeCloseTo(23.05988, 4);
  });

  it('keeps corrected age 0 valid and distinct from a hold before the corrected birth date', () => {
    const ctx = makeContext({ gestationalWeeks: 30, gestationalDays: 0 });

    // 30w0d is 70 days short of 40w0d.
    const atZero = evaluateMeasurement({ id: 'z', date: new Date(2020, 2, 11), height: 50, weight: 3.3 }, ctx);
    expect(atZero?.correctedAge).toBe(0);
    expect(atZero?.isPretermBeforeCorrection).toBe(false);
    expect(atZero?.isStandardEvaluationHeld).toBe(false);
    expect(atZero?.showCorrected).toBe(true);
    expect(atZero?.heightSDS).toBeDefined();

    const before = evaluateMeasurement({ id: 'b', date: new Date(2020, 2, 10), height: 50, weight: 3.3 }, ctx);
    expect(before?.isPretermBeforeCorrection).toBe(true);
    expect(before?.isStandardEvaluationHeld).toBe(true);
    expect(before?.heightSDS).toBeUndefined();
    expect(before?.weightSDS).toBeUndefined();
    // BMI does not depend on gestational status: 3.3 / 0.5^2 = 13.2.
    expect(before?.bmi).toBeCloseTo(13.2, 10);
    expect(atZero?.bmi).toBeCloseTo(13.2, 10);
    // 50 cm is below the height-specific range (70 <= h < 120 under 6 y), so the obesity index is null
    // regardless of the hold. Obesity retained during a hold is covered by golden C5.
    expect(before?.obesityIndex).toBeNull();
    expect(before?.obesityIndexAge).toBeNull();
    expect(before?.isStandardWeightUnusable).toBe(false);
  });

  it('separates a gestational-information hold from a pre-40-week hold', () => {
    const result = evaluateMeasurement(
      { id: 'g', date: new Date(2021, 0, 1), height: 75, weight: 9.5 },
      makeContext({ gestationalWeeks: 30, gestationalDays: 7 })
    );

    expect(result?.isGestationalEvaluationPending).toBe(true);
    expect(result?.isPretermBeforeCorrection).toBe(false);
    expect(result?.isStandardEvaluationHeld).toBe(true);
  });

  it('evaluates a valid weight independently of an invalid height', () => {
    const result = evaluateMeasurement({ id: 'i', date: new Date(2021, 0, 1), height: 'abc', weight: 9.5 }, makeContext());

    expect(result?.isHeightInvalid).toBe(true);
    expect(result?.height).toBeUndefined();
    expect(result?.heightSDS).toBeUndefined();
    expect(result?.isHeightSDSUnavailable).toBe(false);
    expect(result?.weightSDS).toBeDefined();
    expect(result?.bmi).toBeUndefined();
  });

  it('does not calculate height SDS from 211 completed months', () => {
    const result = evaluateMeasurement({ id: 'm', date: new Date(2037, 7, 1), height: 170, weight: 55 }, makeContext());

    expect(result?.isHeightSDSOutOfRange).toBe(true);
    expect(result?.heightSDS).toBeUndefined();
    expect(result?.weightSDS).toBeDefined();
  });

  it('does not mutate its inputs', () => {
    const birthDate = new Date(2020, 0, 1);
    const date = new Date(2021, 0, 1);
    const birthTime = birthDate.getTime();
    const dateTime = date.getTime();
    const measurement = Object.freeze({ id: 'f', date, height: 75, weight: 9.5 });
    const ctx = Object.freeze(makeContext({ birthDate, gestationalWeeks: 30, gestationalDays: 0 }));
    const tableSnapshot = JSON.stringify(FUHYO_BOYS_HEIGHT);

    evaluateMeasurement(measurement, ctx);

    expect(birthDate.getTime()).toBe(birthTime);
    expect(date.getTime()).toBe(dateTime);
    expect(JSON.stringify(FUHYO_BOYS_HEIGHT)).toBe(tableSnapshot);
  });
});
