import { describe, it, expect } from 'vitest';
import { 
  calculateZScore, 
  calculateMeasurementFromZ, 
  calculateObesityIndex,
  calculateObesityIndexByAge,
  calculateHeightVelocity,
  interpolateLMS,
  calculateDecimalAge,
  calculateCorrectedAge,
  calculateFullMonthsAge
} from './growth-utils';

describe('Growth Utils Calculations', () => {
  describe('Z-Score (SDS) Calculations', () => {
    it('should calculate correct Z-score for given LMS values', () => {
      // Basic check: if y == M, Z should be 0
      const lms = { age: 10, L: 1, M: 135, S: 0.05 };
      expect(calculateZScore(135, lms)).toBe(0);
      
      // Check L=0 case (log-normal)
      const lmsLog = { age: 5, L: 0, M: 110, S: 0.1 };
      expect(calculateZScore(110, lmsLog)).toBe(0);
    });

    it('should calculate correct measurement from Z-score', () => {
      const lms = { age: 10, L: 1, M: 135, S: 0.05 };
      expect(calculateMeasurementFromZ(0, lms)).toBe(135);
      
      const lmsLog = { age: 5, L: 0, M: 110, S: 0.1 };
      expect(calculateMeasurementFromZ(0, lmsLog)).toBe(110);
    });
  });

  describe('Obesity Index', () => {
    it('should calculate obesity index for infants correctly', () => {
      // Test for a 5yo male, height 110cm, weight 20kg
      // Using standard weight formula for infants
      const result = calculateObesityIndex(20, 110, 5, 'male');
      expect(result).not.toBeNull();
      if (result) expect(result).toBeGreaterThan(-100);
    });

    it('should calculate school-age obesity index correctly (Table 1)', () => {
      // Test for a 10yo male, height 140cm, weight 40kg
      const result = calculateObesityIndexByAge(40, 140, 10, 'male');
      // coeffs for 10y male: a=0.752, b=70.461
      // stdWeight = 0.752 * 140 - 70.461 = 34.819
      // index = (40 - 34.819) / 34.819 * 100 approx 14.88
      expect(result).toBeCloseTo(14.88, 1);
    });
  });

  describe('Height Velocity', () => {
    it('should calculate velocity correctly for 1 year interval', () => {
      const result = calculateHeightVelocity(130, 10, 136, 11);
      expect(result?.velocity).toBe(6);
      expect(result?.midpointAge).toBe(10.5);
    });

    it('should return null if interval is less than 1 year', () => {
      const result = calculateHeightVelocity(130, 10, 133, 10.5);
      expect(result).toBeNull();
    });
  });

  describe('Interpolation', () => {
    it('should handle boundary constraints for interpolation', () => {
      const table = [
        { age: 1, L: 1, M: 10, S: 0.1 },
        { age: 2, L: 1, M: 20, S: 0.2 }
      ];
      // Under range
      expect(interpolateLMS(0, table).M).toBe(10);
      // Over range
      expect(interpolateLMS(3, table).M).toBe(20);
    });

    it('should interpolate values smoothly between table points', () => {
      const table = [
        { age: 0, L: 1, M: 50, S: 0.1 },
        { age: 1, L: 1.5, M: 75, S: 0.12 },
        { age: 2, L: 2, M: 95, S: 0.14 },
        { age: 3, L: 2.5, M: 110, S: 0.16 }
      ];
      const result = interpolateLMS(0.5, table);
      expect(result.M).toBeGreaterThan(50);
      expect(result.M).toBeLessThan(75);
      expect(result.L).toBeGreaterThan(1);
      expect(result.L).toBeLessThan(1.5);
    });
  });

  describe('calculateDecimalAge Additional Edge Cases', () => {
    it('should handle leap years correctly (e.g., 2020 has 366 days)', () => {
      const birth = new Date('2020-01-01');
      const measure = new Date('2021-01-01'); // exactly 1 year
      const age = calculateDecimalAge(birth, measure);
      expect(age).toBe(1.0000);
    });

    it('should calculate accurate fractional age for mid-year measurements', () => {
      const birth = new Date('2021-01-01');
      const measure = new Date('2021-07-02'); // ~182 days
      const age = calculateDecimalAge(birth, measure);
      expect(age).toBeCloseTo(0.5, 1);
    });
  });

  describe('calculateCorrectedAge Preterm Logic', () => {
    it('should not apply corrected age for term infants (>=37 weeks)', () => {
      const birth = new Date('2020-01-01');
      const measure = new Date('2020-04-01');
      const uncorrected = calculateDecimalAge(birth, measure);
      const corrected = calculateCorrectedAge(birth, measure, 37, 0);
      expect(corrected).toBe(uncorrected);
    });

    it('should apply accurate gestational correction deficit for preterm infants', () => {
      const birth = new Date('2020-01-01');
      const measure = new Date('2020-06-01');
      // Born at 34 weeks, 0 days -> 6 weeks (42 days) preterm
      const corrected = calculateCorrectedAge(birth, measure, 34, 0);
      const expectedBirth = new Date('2020-02-12'); // 42 days later
      const expectedAge = calculateDecimalAge(expectedBirth, measure);
      expect(corrected).toBe(expectedAge);
    });

    it('should clamp gestational weeks below 22 weeks and above 44 weeks', () => {
      const birth = new Date('2020-01-01');
      const measure = new Date('2020-06-01');
      // 18 weeks should clamp to 22 weeks
      const corrected18 = calculateCorrectedAge(birth, measure, 18, 0);
      const corrected22 = calculateCorrectedAge(birth, measure, 22, 0);
      expect(corrected18).toBe(corrected22);

      // 48 weeks should clamp to 44 weeks (no correction applied since 44 >= 37)
      const corrected48 = calculateCorrectedAge(birth, measure, 48, 0);
      const uncorrected = calculateDecimalAge(birth, measure);
      expect(corrected48).toBe(uncorrected);
    });
  });

  describe('calculateFullMonthsAge formatting', () => {
    it('should format early infant age in completed months', () => {
      const birth = new Date('2020-01-01');
      const measure = new Date('2020-04-01'); // exactly 3 months
      expect(calculateFullMonthsAge(birth, measure)).toBe('満3ヶ月');
    });

    it('should format toddler and older children ages with years and months', () => {
      const birth = new Date('2020-01-01');
      const measure = new Date('2021-07-01'); // 1 year 6 months
      expect(calculateFullMonthsAge(birth, measure)).toBe('満1歳6ヶ月');
    });

    it('should return 生誕前 if the measurement date is before birth date', () => {
      const birth = new Date('2020-01-01');
      const measure = new Date('2019-12-15');
      expect(calculateFullMonthsAge(birth, measure)).toBe('生誕前');
    });

    it('should return 満0ヶ月 for the first month', () => {
      const birth = new Date('2020-01-01');
      const measure = new Date('2020-01-15');
      expect(calculateFullMonthsAge(birth, measure)).toBe('満0ヶ月');
    });
  });
});
