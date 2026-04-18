import { describe, it, expect } from 'vitest';
import { 
  calculateZScore, 
  calculateMeasurementFromZ, 
  calculateObesityIndex,
  calculateObesityIndexByAge,
  calculateHeightVelocity,
  interpolateLMS
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
  });
});
