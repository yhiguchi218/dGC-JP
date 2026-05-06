import { describe, it, expect } from 'vitest';
import { calculateDecimalAge, interpolateLMS } from './growth-utils';
import { HEIGHT_BOYS_LMS } from '../data/growth-data';

describe('Edge Case Analysis', () => {
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
