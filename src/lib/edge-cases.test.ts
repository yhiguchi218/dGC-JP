import { describe, it, expect } from 'vitest';
import { calculateDecimalAge, interpolateLMS, calculateCorrectedAge } from './growth-utils';
import { HEIGHT_BOYS_LMS } from '../data/growth-data';

describe('Edge Case Analysis', () => {
  describe('Gestational Age Clamping', () => {
    it('should clamp gestational weeks below 22 to 22', () => {
      const birth = new Date('2020-01-01');
      const measure = new Date('2020-02-01');
      // 20 weeks 0 days should be treated as 22 weeks 0 days
      const corrected = calculateCorrectedAge(birth, measure, 20, 0);
      const expectedAt22 = calculateCorrectedAge(birth, measure, 22, 0);
      expect(corrected).toBe(expectedAt22);
      console.log('Clamped result (20w -> 22w):', corrected);
    });

    it('should clamp gestational weeks above 44 to 44', () => {
      const birth = new Date('2020-01-01');
      const measure = new Date('2020-02-01');
      // 45 weeks 0 days should be treated as 44 weeks 0 days
      const corrected = calculateCorrectedAge(birth, measure, 45, 0);
      const expectedAt44 = calculateCorrectedAge(birth, measure, 44, 0);
      expect(corrected).toBe(expectedAt44);
      console.log('Clamped result (45w -> 44w):', corrected);
    });
  });

  describe('Negative Age', () => {
    it('should return a negative decimal age if measurement is before birth', () => {
      const birth = new Date('2020-01-01');
      const measurement = new Date('2019-01-01');
      const age = calculateDecimalAge(birth, measurement);
      expect(age).toBeLessThan(0);
      console.log('Negative age result:', age);
    });

    it('should fall back to birth LMS if age is negative in interpolation', () => {
      const age = -1;
      const lms = interpolateLMS(age, HEIGHT_BOYS_LMS);
      expect(lms.age).toBe(-1); // age is set to input age
      expect(lms.M).toBe(HEIGHT_BOYS_LMS[0].M); // but values are from birth
      console.log('LMS for age -1 (M):', lms.M);
    });
  });

  describe('Out of Range Age (Over 18)', () => {
    it('should return age > 18', () => {
      const birth = new Date('2000-01-01');
      const measurement = new Date('2020-01-01');
      const age = calculateDecimalAge(birth, measurement);
      expect(age).toBeGreaterThan(18);
      console.log('Age 20 result:', age);
    });

    it('should fall back to max age LMS if age is over range', () => {
      const age = 20;
      const lms = interpolateLMS(age, HEIGHT_BOYS_LMS);
      expect(lms.M).toBe(HEIGHT_BOYS_LMS[HEIGHT_BOYS_LMS.length - 1].M);
      console.log('LMS for age 20 (M):', lms.M);
    });
  });
});
