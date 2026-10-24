import { describe, expect, it } from 'vitest';
import { evaluateMeasurement, type MeasurementEvaluationContext } from './measurement-evaluation';
import { FUHYO_BOYS_HEIGHT, FUHYO_GIRLS_HEIGHT } from '../data/fuhyo-growth-data';
import { WEIGHT_BOYS_LMS, WEIGHT_GIRLS_LMS } from '../data/growth-data';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

// Expected values are fixed numbers from independent arithmetic on the original CSV (Table S2) cells; see
// scripts/achondroplasia-clarity-wfh-independent-check.ts. They are not taken from production output.
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

describe('evaluateMeasurement: CLARITY weight-for-height', () => {
  it('calculates the weight-for-height SDS from the same row height and weight (male 95 cm / 23.33 kg)', () => {
    const r = evalOne(d(2023, 1, 1), 95, 23.33);
    expect(r.weightForHeightStatus).toBe('ok');
    expect(r.weightForHeightSDS).toBeCloseTo(1.49843233548101, 9);
  });

  it('uses the girls table for female (134 cm / 53.63 kg) and interpolates fractional heights (95.25 cm male)', () => {
    const girl = evalOne(d(2030, 1, 1), 134, 53.63, ctx({ sexKey: 'female', fuhyoHeightTable: FUHYO_GIRLS_HEIGHT, weightTable: WEIGHT_GIRLS_LMS }));
    expect(girl.weightForHeightSDS).toBeCloseTo(-0.500196926257958, 9);
    const boy = evalOne(d(2023, 1, 1), 95.25, 23.55);
    expect(boy.weightForHeightSDS).toBeCloseTo(1.49990338332108, 9);
  });

  it('is evaluated even while the gestational status holds the age-based SDS', () => {
    const held = evalOne(d(2021, 1, 1), 95, 23.33, ctx({ gestationalWeeks: Number.NaN }));
    expect(held.isStandardEvaluationHeld).toBe(true);
    expect(held.heightSDS).toBeUndefined();
    expect(held.weightSDS).toBeUndefined();
    expect(held.weightForHeightStatus).toBe('ok');
    expect(held.weightForHeightSDS).toBeCloseTo(1.49843233548101, 9);

    const invalidDays = evalOne(d(2021, 1, 1), 95, 23.33, ctx({ gestationalWeeks: 30, gestationalDays: 9 }));
    expect(invalidDays.isStandardEvaluationHeld).toBe(true);
    expect(invalidDays.weightSDS).toBeUndefined();
    expect(invalidDays.weightForHeightSDS).toBeCloseTo(1.49843233548101, 9);
  });

  it('does not depend on age, corrected age or gestation: the same height/weight gives the same SDS', () => {
    const results = [
      evalOne(d(2021, 1, 1), 95, 23.33),
      evalOne(d(2023, 7, 1), 95, 23.33),
      evalOne(d(2025, 1, 1), 95, 23.33, ctx({ gestationalWeeks: 28, gestationalDays: 3 })),
      evalOne(d(2040, 1, 1), 95, 23.33), // beyond the 18-year age limit of the age-based CLARITY SDS
    ];
    for (const r of results) expect(r.weightForHeightSDS).toBeCloseTo(1.49843233548101, 9);
  });

  it('is still calculated beyond the age limit of the age-based SDS', () => {
    const r = evalOne(d(2040, 1, 1), 95, 23.33, ctx({ birthDate: d(2010, 1, 1) }));
    expect(r.age).toBeGreaterThan(18);
    expect(r.heightSDS).toBeUndefined();
    expect(r.isHeightSDSOutOfRange).toBe(true);
    expect(r.weightForHeightStatus).toBe('ok');
    expect(r.weightForHeightSDS).toBeCloseTo(1.49843233548101, 9);
  });

  it('is out-of-range above the boys 140 cm limit and above the girls 134 cm limit, with no SDS value', () => {
    const boy = evalOne(d(2030, 1, 1), 141, 60);
    expect(boy.weightForHeightStatus).toBe('out-of-range');
    expect(boy.weightForHeightSDS).toBeUndefined();
    const girl = evalOne(d(2030, 1, 1), 135, 60, ctx({ sexKey: 'female', fuhyoHeightTable: FUHYO_GIRLS_HEIGHT, weightTable: WEIGHT_GIRLS_LMS }));
    expect(girl.weightForHeightStatus).toBe('out-of-range');
    expect(girl.weightForHeightSDS).toBeUndefined();
    const below = evalOne(d(2021, 1, 1), 49.9, 3);
    expect(below.weightForHeightStatus).toBe('out-of-range');
  });

  it('distinguishes not-entered from invalid input and never turns either into a value', () => {
    expect(evalOne(d(2023, 1, 1), 95, undefined).weightForHeightStatus).toBe('not-entered');
    expect(evalOne(d(2023, 1, 1), undefined, 23.33).weightForHeightStatus).toBe('not-entered');
    expect(evalOne(d(2023, 1, 1), '', '').weightForHeightStatus).toBe('not-entered');
    const badHeight = evalOne(d(2023, 1, 1), 'abc', 23.33);
    expect(badHeight.weightForHeightStatus).toBe('invalid-input');
    expect(badHeight.weightForHeightSDS).toBeUndefined();
    const badWeight = evalOne(d(2023, 1, 1), 95, 'abc');
    expect(badWeight.weightForHeightStatus).toBe('invalid-input');
    expect(badWeight.weightForHeightSDS).toBeUndefined();
  });

  it('does not let a missing weight block the height SDS, nor a missing height block the weight SDS', () => {
    const heightOnly = evalOne(d(2021, 1, 1), 71.9, undefined);
    expect(heightOnly.heightSDS).toBeCloseTo(3.07653137549157, 9);
    expect(heightOnly.weightForHeightStatus).toBe('not-entered');
    const weightOnly = evalOne(d(2021, 1, 1), undefined, 9.15);
    expect(weightOnly.weightSDS).toBeCloseTo(1.49764778590863, 9);
    expect(weightOnly.weightForHeightStatus).toBe('not-entered');
  });

  it('leaves the age-based height and weight SDS unchanged by the weight-for-height result', () => {
    // Same fixed values as the existing CLARITY evaluation test (male, 12 completed months).
    const r = evalOne(d(2021, 1, 1), 71.9, 9.15);
    expect(r.heightSDS).toBeCloseTo(3.07653137549157, 9);
    expect(r.weightSDS).toBeCloseTo(1.49764778590863, 9);
    expect(r.weightForHeightStatus).toBe('ok');
  });

  it('keeps BMI, the Japanese obesity indices and the height-velocity inputs out of CLARITY', () => {
    const r = evalOne(d(2023, 1, 1), 95, 23.33);
    expect(r.bmi).toBeUndefined();
    expect(r.obesityIndex).toBeNull();
    expect(r.obesityIndexAge).toBeNull();
  });

  it('is not applicable for the Japanese reference', () => {
    const r = evalOne(d(2023, 1, 1), 95, 23.33, ctx({ growthReference: 'japanese' }));
    expect(r.weightForHeightStatus).toBe('not-applicable');
    expect(r.weightForHeightSDS).toBeUndefined();
    const defaulted = evaluateMeasurement({ id: 'm', date: d(2023, 1, 1), height: 95, weight: 23.33 }, { ...ctx(), growthReference: undefined });
    expect(defaulted?.weightForHeightStatus).toBe('not-applicable');
  });
});
