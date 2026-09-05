import { describe, expect, it } from 'vitest';
import { GOLDEN_VALIDATION_CASES } from '../data/golden-validation-cases';
import { HEIGHT_BOYS_LMS, HEIGHT_GIRLS_LMS, WEIGHT_BOYS_LMS, WEIGHT_GIRLS_LMS } from '../data/growth-data';
import { interpolateLMS } from './growth-utils';

describe('Golden validation dataset', () => {
  it('covers both sexes across the canonical milestone ages', () => {
    expect(GOLDEN_VALIDATION_CASES).toHaveLength(18);
    expect(new Set(GOLDEN_VALIDATION_CASES.map(testCase => testCase.sex))).toEqual(new Set(['male', 'female']));
    expect(new Set(GOLDEN_VALIDATION_CASES.map(testCase => testCase.age))).toEqual(
      new Set([0, 0.25, 0.5, 1, 2, 3, 6, 10, 17.5])
    );
  });

  it.each(GOLDEN_VALIDATION_CASES)('matches exact LMS medians for $label', ({ sex, age, expectedHeight, expectedWeight }) => {
    const heightTable = sex === 'male' ? HEIGHT_BOYS_LMS : HEIGHT_GIRLS_LMS;
    const weightTable = sex === 'male' ? WEIGHT_BOYS_LMS : WEIGHT_GIRLS_LMS;

    expect(interpolateLMS(age, heightTable).M).toBe(expectedHeight);
    expect(interpolateLMS(age, weightTable).M).toBe(expectedWeight);
  });
});
