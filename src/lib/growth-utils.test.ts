import { describe, it, expect } from 'vitest';
import { 
  calculateZScore, 
  calculateMeasurementFromZ, 
  calculateObesityIndex,
  calculateObesityIndexByAge,
  calculateStandardWeight,
  calculateStandardWeightByAge,
  calculateHeightVelocity,
  isSuwaHVInterval,
  findBestSuwaPair,
  interpolateLMS,
  interpolateHV,
  calculateHVSDS,
  calculateDecimalAge,
  calculateCorrectedAge,
  calculateFullMonthsAge,
  getCorrectedBirthDate
} from './growth-utils';
import { SUWA_HV_BOYS, SUWA_HV_GIRLS } from '../data/suwa-hv-data';

describe('Growth Utils Calculations', () => {
  describe('Z-Score (SDS) Calculations', () => {
    it('should calculate correct Z-score for given LMS values', () => {
      // Basic check: if y == M, Z should be 0
      const lms = { age: 10, L: 1, M: 135, S: 0.05 };
      expect(calculateZScore(135, lms)).toBe(0);
      
      // Check L=0 case (log-normal)
      const lmsLog = { age: 5, L: 0, M: 110, S: 0.1 };
      expect(calculateZScore(110, lmsLog)).toBe(0);

      // Check positive and negative Z-scores
      expect(calculateZScore(141.75, lms)).toBeCloseTo(1, 2);
    });

    it('should calculate correct measurement from Z-score', () => {
      const lms = { age: 10, L: 1, M: 135, S: 0.05 };
      expect(calculateMeasurementFromZ(0, lms)).toBe(135);
      
      const lmsLog = { age: 5, L: 0, M: 110, S: 0.1 };
      expect(calculateMeasurementFromZ(0, lmsLog)).toBe(110);

      expect(calculateMeasurementFromZ(1, lms)).toBeCloseTo(141.75, 2);
    });
  });

  describe('Standard Weight and Obesity Index', () => {
    it('should calculate standard weight for infant boys and girls (<6y)', () => {
      const boyInfant = calculateStandardWeight(100, 4, 'male');
      expect(boyInfant).not.toBeNull();
      expect(boyInfant).toBeGreaterThan(10);
      expect(boyInfant).toBeLessThan(25);

      const girlInfant = calculateStandardWeight(100, 4, 'female');
      expect(girlInfant).not.toBeNull();
      expect(girlInfant).toBeGreaterThan(10);
      expect(girlInfant).toBeLessThan(25);
    });

    it('should calculate standard weight for school-age boys and girls (6y+ across height ranges)', () => {
      // Boy 120cm (101 <= X < 140)
      const b1 = calculateStandardWeight(120, 7, 'male');
      expect(b1).not.toBeNull();

      // Boy 145cm (140 <= X < 149)
      const b2 = calculateStandardWeight(145, 11, 'male');
      expect(b2).not.toBeNull();

      // Boy 160cm (149 <= X < 184)
      const b3 = calculateStandardWeight(160, 14, 'male');
      expect(b3).not.toBeNull();

      // Girl 120cm (101 <= X < 140)
      const g1 = calculateStandardWeight(120, 7, 'female');
      expect(g1).not.toBeNull();

      // Girl 145cm (140 <= X < 149)
      const g2 = calculateStandardWeight(145, 11, 'female');
      expect(g2).not.toBeNull();

      // Girl 160cm (149 <= X < 171)
      const g3 = calculateStandardWeight(160, 14, 'female');
      expect(g3).not.toBeNull();

      // Out of range height returns null
      expect(calculateStandardWeight(200, 14, 'male')).toBeNull();
    });

    it('should calculate obesity index for infants correctly', () => {
      const result = calculateObesityIndex(20, 110, 5, 'male');
      expect(result).not.toBeNull();
      if (result) expect(result).toBeGreaterThan(-100);

      // Returns null for invalid height range
      expect(calculateObesityIndex(20, 60, 5, 'male')).toBeNull();
    });

    it('should calculate school-age obesity index correctly (Table 1)', () => {
      const result = calculateObesityIndexByAge(40, 140, 10, 'male');
      expect(result).toBeCloseTo(14.88, 1);

      // Girls Table 1 test
      const girlResult = calculateObesityIndexByAge(35, 140, 10, 'female');
      expect(girlResult).not.toBeNull();

      // Out of age range returns null (<5y or >17y)
      expect(calculateStandardWeightByAge(140, 4, 'male')).toBeNull();
      expect(calculateStandardWeightByAge(140, 18, 'male')).toBeNull();
    });
  });

  describe('Height Velocity and HV SDS', () => {
    it('should calculate velocity correctly for 1 year interval', () => {
      const result = calculateHeightVelocity(130, 10, 136, 11);
      expect(result?.velocity).toBe(6);
      expect(result?.midpointAge).toBe(10.5);
    });

    it('should calculate velocity for the minimum raw clinical interval', () => {
      const result = calculateHeightVelocity(130, 10, 133, 10.5);
      expect(result?.velocity).toBe(6);
      expect(result?.midpointAge).toBe(10.25);
    });

    it('should return null if interval is shorter than the raw minimum interval', () => {
      const result = calculateHeightVelocity(130, 10, 132.5, 10.4);
      expect(result).toBeNull();
    });

    it('should identify the Suwa interval window boundaries', () => {
      expect(isSuwaHVInterval(0.95)).toBe(true);
      expect(isSuwaHVInterval(1.0)).toBe(true);
      expect(isSuwaHVInterval(1.05)).toBe(true);
      expect(isSuwaHVInterval(0.94)).toBe(false);
      expect(isSuwaHVInterval(1.06)).toBe(false);
    });

    it('should select the prior measurement closest to one year earlier for Suwa pairing', () => {
      const points = [
        { age: 4.0, height: 101.0 },
        { age: 4.9, height: 107.0 },
        { age: 5.0, height: 107.4 },
        { age: 6.01, height: 113.8 },
      ];

      expect(findBestSuwaPair(3, points)).toBe(2);
      expect(findBestSuwaPair(1, points)).toBeNull();
    });

    it('should interpolate Suwa HV reference values and calculate HV-SDS', () => {
      const hvRef = interpolateHV(10.5, SUWA_HV_BOYS);
      expect(hvRef.mean).toBeGreaterThan(0);
      expect(hvRef.sd).toBeGreaterThan(0);

      const sds = calculateHVSDS(6.0, 10.5, 'male', SUWA_HV_BOYS);
      expect(sds).not.toBeNull();
      expect(typeof sds).toBe('number');

      // Edge cases for age below min or above max table
      const underHV = interpolateHV(0, SUWA_HV_BOYS);
      expect(underHV.mean).toBe(SUWA_HV_BOYS[0].mean);

      const overHV = interpolateHV(20, SUWA_HV_BOYS);
      expect(overHV.mean).toBe(SUWA_HV_BOYS[SUWA_HV_BOYS.length - 1].mean);
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
    it('should return null if measurement is before birth date', () => {
      const birth = new Date('2020-01-01');
      const measure = new Date('2019-12-01');
      expect(calculateDecimalAge(birth, measure)).toBeNull();
    });

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

    it('should not apply corrected age after 3 years old', () => {
      const birth = new Date('2020-01-01');
      const measure = new Date('2024-01-01'); // 4 years old
      const uncorrected = calculateDecimalAge(birth, measure);
      const corrected = calculateCorrectedAge(birth, measure, 32, 0);
      expect(corrected).toBe(uncorrected);
    });
  });

  describe('getCorrectedBirthDate', () => {
    it('should return same birth date for term births', () => {
      const birth = new Date('2020-01-01');
      expect(getCorrectedBirthDate(birth, 40, 0)).toEqual(birth);
      expect(getCorrectedBirthDate(birth, 37, 0)).toEqual(birth);
    });

    it('should return forward shifted birth date for preterm births', () => {
      const birth = new Date('2020-01-01');
      // 36 weeks -> 4 weeks = 28 days
      const corrected = getCorrectedBirthDate(birth, 36, 0);
      expect(corrected.getDate()).toBe(29);
      expect(corrected.getMonth()).toBe(0); // January 29
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
