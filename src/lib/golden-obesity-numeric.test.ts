import { describe, expect, it } from 'vitest';
import {
  calculateObesityIndex,
  calculateObesityIndexByAge,
  calculateStandardWeight,
  calculateStandardWeightByAge,
} from './growth-utils';
import { GOLDEN_OBESITY_CASES } from '../data/golden-obesity-cases';

// Fixed expectations from scripts/golden-obesity-independent-check.ts using the implementation coefficients at e3ce6e6.
// This checks the calculation path and the range / switching boundaries, not the coefficients against the original source.
// CALC_TOLERANCE is for floating-point noise only; display rounding is asserted separately.
const CALC_TOLERANCE = 1e-9;

const standard = (c: (typeof GOLDEN_OBESITY_CASES)[number]) =>
  c.method === 'height'
    ? calculateStandardWeight(c.height, c.age, c.sex)
    : calculateStandardWeightByAge(c.height, c.age, c.sex);
const index = (c: (typeof GOLDEN_OBESITY_CASES)[number]) =>
  c.method === 'height'
    ? calculateObesityIndex(c.weight, c.height, c.age, c.sex)
    : calculateObesityIndexByAge(c.weight, c.height, c.age, c.sex);

describe('golden obesity numeric values (standard weight and index)', () => {
  it.each(GOLDEN_OBESITY_CASES.map(c => [`${c.method} ${c.sex}: ${c.id}`, c] as const))('%s', (_name, c) => {
    const sw = standard(c);
    const idx = index(c);
    if (c.expectedStandardWeight === null) {
      expect(sw).toBeNull();
      expect(idx).toBeNull();
    } else {
      expect(sw).not.toBeNull();
      expect(Math.abs((sw as number) - c.expectedStandardWeight)).toBeLessThan(CALC_TOLERANCE);
      expect(idx).not.toBeNull();
      expect(Math.abs((idx as number) - (c.expectedIndex as number))).toBeLessThan(CALC_TOLERANCE);
    }
  });

  it('hand-checked values: standard weights 15.4673 / 15.356 / 34.819 kg', () => {
    expect(calculateStandardWeight(100, 4, 'male') as number).toBeCloseTo(15.4673, 9);
    expect(calculateStandardWeight(100, 4, 'female') as number).toBeCloseTo(15.356, 9);
    expect(calculateStandardWeightByAge(140, 10, 'male') as number).toBeCloseTo(34.819, 9);
  });

  it('display rounding is separate from the calculation: 40 kg at 140 cm, boys 10 y (age-specific) -> 14.9%', () => {
    // (40 - 34.819) / 34.819 * 100 = 14.87980...
    const value = calculateObesityIndexByAge(40, 140, 10, 'male') as number;
    expect(Math.abs(value - 14.87980700)).toBeLessThan(1e-6);
    expect(value.toFixed(1)).toBe('14.9');
  });

  it('an index of exactly 0 is a value, not a missing result', () => {
    expect(calculateObesityIndex(15.356, 100, 4, 'female')).not.toBeNull();
    expect(Math.abs(calculateObesityIndex(15.356, 100, 4, 'female') as number)).toBeLessThan(CALC_TOLERANCE);
  });
});
