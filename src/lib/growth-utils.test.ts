import { describe, it, expect } from 'vitest';
import { differenceInMonths } from 'date-fns';
import { 
  calculateZScore, 
  calculateMeasurementFromZ, 
  calculateObesityIndex,
  calculateObesityIndexByAge,
  calculateStandardWeight,
  calculateStandardWeightByAge,
  calculateHeightVelocity,
  calculateHeightVelocityResults,
  isSuwaHVInterval,
  findBestSuwaPair,
  interpolateLMS,
  interpolateHV,
  calculateHVSDS,
  calculateDecimalAge,
  calculateCorrectedAge,
  calculateFullMonthsAge,
  calculateWeightSDSByCompletedMonths,
  getCorrectedBirthDate,
  isValidGestationalDays,
  isValidGestationalWeeks
} from './growth-utils';
import { HVReferencePoint, SUWA_HV_BOYS, SUWA_HV_GIRLS } from '../data/suwa-hv-data';
import { WEIGHT_BOYS_LMS, WEIGHT_GIRLS_LMS } from '../data/growth-data';
import { MONTHLY_WEIGHT_SDS_GOLDEN_CASES } from './monthly-weight-sds-golden-cases';

describe('Growth Utils Calculations', () => {
  describe('weight SDS by completed months', () => {
    it.each(MONTHLY_WEIGHT_SDS_GOLDEN_CASES)(
      'matches independently calculated fixed golden $label at $completedMonths months',
      ({ sex, birthDate, measurementDate, weight, completedMonths, lmsSupportPoints, expectedSDS, expectedDisplay }) => {
        const table = sex === 'male' ? WEIGHT_BOYS_LMS : WEIGHT_GIRLS_LMS;
        const birth = new Date(`${birthDate}T00:00:00`);
        const measured = new Date(`${measurementDate}T00:00:00`);
        const result = calculateWeightSDSByCompletedMonths(
          weight,
          birth,
          measured,
          table
        );

        expect(table
          .filter(point => lmsSupportPoints.some(([age]) => age === point.age))
          .map(({ age, L, M, S }) => [age, L, M, S]))
          .toEqual(lmsSupportPoints);
        expect(differenceInMonths(measured, birth)).toBe(completedMonths);
        expect(result).toBeCloseTo(expectedSDS, 12);
        expect(result?.toFixed(2)).toBe(expectedDisplay);
      }
    );

    it('uses the same LMS reference throughout a completed month and switches on its anniversary', () => {
      const birthDate = new Date(2024, 5, 7);
      const beforeMonth = calculateWeightSDSByCompletedMonths(11.1, birthDate, new Date(2026, 5, 6), WEIGHT_GIRLS_LMS);
      const monthStart = calculateWeightSDSByCompletedMonths(11.1, birthDate, new Date(2026, 5, 7), WEIGHT_GIRLS_LMS);
      const monthEnd = calculateWeightSDSByCompletedMonths(11.1, birthDate, new Date(2026, 5, 30), WEIGHT_GIRLS_LMS);
      const nextMonth = calculateWeightSDSByCompletedMonths(11.1, birthDate, new Date(2026, 6, 7), WEIGHT_GIRLS_LMS);

      expect(beforeMonth).toBeCloseTo(0.2933063975354676, 12);
      expect(monthStart).toBeCloseTo(0.08595455685908822, 12);
      expect(monthEnd).toBe(monthStart);
      expect(nextMonth).toBeCloseTo(-0.04734361593447061, 12);
    });

    it('follows date-fns completed-month behavior for month-end and leap-day births', () => {
      const leapBirth = new Date(2020, 1, 29);
      const beforeAnniversary = new Date(2021, 1, 27);
      const anniversary = new Date(2021, 1, 28);

      expect(differenceInMonths(beforeAnniversary, leapBirth)).toBe(11);
      expect(differenceInMonths(anniversary, leapBirth)).toBe(12);
      expect(calculateWeightSDSByCompletedMonths(11, leapBirth, beforeAnniversary, WEIGHT_GIRLS_LMS))
        .not.toBe(calculateWeightSDSByCompletedMonths(11, leapBirth, anniversary, WEIGHT_GIRLS_LMS));
    });

    it('retains LMS endpoint clamping at 210, 211 months, and beyond 18 years', () => {
      const birthDate = new Date(2000, 0, 1);
      const at210 = calculateWeightSDSByCompletedMonths(70, birthDate, new Date(2017, 6, 1), WEIGHT_BOYS_LMS);
      const at211 = calculateWeightSDSByCompletedMonths(70, birthDate, new Date(2017, 7, 1), WEIGHT_BOYS_LMS);
      const after18 = calculateWeightSDSByCompletedMonths(70, birthDate, new Date(2020, 0, 1), WEIGHT_BOYS_LMS);
      const endpoint = calculateWeightSDSByCompletedMonths(70, birthDate, new Date(2017, 6, 1), WEIGHT_BOYS_LMS);

      expect(at210).toBe(endpoint);
      expect(at211).toBe(endpoint);
      expect(after18).toBe(endpoint);
    });

    it('returns a valid numeric zero SDS and fails closed for invalid or reversed dates and weights', () => {
      const birthDate = new Date(2024, 5, 7);
      const zeroSDS = calculateWeightSDSByCompletedMonths(11, birthDate, new Date(2026, 5, 7), WEIGHT_GIRLS_LMS);
      expect(zeroSDS === 0).toBe(true);
      expect(calculateWeightSDSByCompletedMonths(11.1, new Date(Number.NaN), new Date(2026, 5, 7), WEIGHT_GIRLS_LMS)).toBeNull();
      expect(calculateWeightSDSByCompletedMonths(11.1, birthDate, new Date(Number.NaN), WEIGHT_GIRLS_LMS)).toBeNull();
      expect(calculateWeightSDSByCompletedMonths(11.1, birthDate, new Date(2024, 5, 6), WEIGHT_GIRLS_LMS)).toBeNull();
      expect(calculateWeightSDSByCompletedMonths(0, birthDate, new Date(2026, 5, 7), WEIGHT_GIRLS_LMS)).toBeNull();
      expect(calculateWeightSDSByCompletedMonths(11.1, birthDate, new Date(2026, 5, 7), [])).toBeNull();
    });
  });

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

    it('keeps the adjacent raw interval separate from the one-year Suwa interval', () => {
      const january2025 = new Date(2025, 0, 1);
      const july2025 = new Date(2025, 6, 1);
      const january2026 = new Date(2026, 0, 1);
      const results = calculateHeightVelocityResults([
        { date: january2025, age: 5, height: 120 },
        { date: july2025, age: 5.5, height: 123 },
        { date: january2026, age: 6, height: 126 },
      ], 'male', SUWA_HV_BOYS);
      const latest = results[1];

      expect(latest.raw?.startDate).toBe(july2025);
      expect(latest.raw?.endDate).toBe(january2026);
      expect(latest.raw?.velocity).toBe(6);
      expect(latest.suwa?.startDate).toBe(january2025);
      expect(latest.suwa?.endDate).toBe(january2026);
      expect(latest.suwa?.velocity).toBe(6);
      expect(latest.suwa?.sds).not.toBeNull();
    });

    it('uses the adjacent raw interval even when intermediate quarterly measurements exist', () => {
      const january2025 = new Date(2025, 0, 1);
      const april2025 = new Date(2025, 3, 1);
      const july2025 = new Date(2025, 6, 1);
      const january2026 = new Date(2026, 0, 1);
      const results = calculateHeightVelocityResults([
        { date: january2025, age: 5, height: 120 },
        { date: april2025, age: 5.25, height: 121.5 },
        { date: july2025, age: 5.5, height: 123 },
        { date: january2026, age: 6, height: 126 },
      ], 'male', SUWA_HV_BOYS);
      const latest = results.find(result => result.currentDate === january2026);

      expect(latest?.raw?.startDate).toBe(july2025);
      expect(latest?.raw?.velocity).toBe(6);
      expect(latest?.suwa?.startDate).toBe(january2025);
      expect(latest?.suwa?.velocity).toBe(6);
    });

    it('does not calculate raw HV below six months but retains a compatible Suwa pair', () => {
      const january2025 = new Date(2025, 0, 1);
      const april2025 = new Date(2025, 3, 1);
      const july2025 = new Date(2025, 6, 1);
      const october2025 = new Date(2025, 9, 1);
      const january2026 = new Date(2026, 0, 1);
      const results = calculateHeightVelocityResults([
        { date: january2025, age: 5, height: 120 },
        { date: april2025, age: 5.25, height: 121.5 },
        { date: july2025, age: 5.5, height: 123 },
        { date: october2025, age: 5.75, height: 124.5 },
        { date: january2026, age: 6, height: 126 },
      ], 'male', SUWA_HV_BOYS);
      const latest = results.find(result => result.currentDate === january2026);

      expect(latest?.raw).toBeNull();
      expect(latest?.suwa?.startDate).toBe(january2025);
      expect(latest?.suwa?.velocity).toBe(6);
      expect(latest?.suwa?.sds).not.toBeNull();
    });

    it('omits entries when neither raw nor Suwa HV can be calculated', () => {
      const results = calculateHeightVelocityResults([
        { date: new Date(2025, 0, 1), age: 0, height: 50 },
        { date: new Date(2025, 1, 1), age: 1 / 12, height: 51 },
        { date: new Date(2025, 2, 1), age: 2 / 12, height: 52 },
        { date: new Date(2025, 3, 1), age: 3 / 12, height: 53 },
      ], 'male', SUWA_HV_BOYS);

      expect(results).toEqual([]);
    });

    it('retains records that have raw HV but no Suwa-compatible pair', () => {
      const results = calculateHeightVelocityResults([
        { date: new Date(2025, 0, 1), age: 0, height: 50 },
        { date: new Date(2025, 6, 1), age: 0.5, height: 53 },
      ], 'male', SUWA_HV_BOYS);

      expect(results).toHaveLength(1);
      expect(results[0].raw).not.toBeNull();
      expect(results[0].suwa).toBeNull();
    });

    it('retains records that have Suwa HV but no adjacent raw HV', () => {
      const results = calculateHeightVelocityResults([
        { date: new Date(2025, 0, 1), age: 0, height: 50 },
        { date: new Date(2025, 3, 1), age: 0.25, height: 51.5 },
        { date: new Date(2025, 6, 1), age: 0.5, height: 53 },
        { date: new Date(2025, 9, 1), age: 0.75, height: 54.5 },
        { date: new Date(2026, 0, 1), age: 1, height: 56 },
      ], 'male', SUWA_HV_BOYS);

      expect(results).toHaveLength(1);
      expect(results[0].raw).toBeNull();
      expect(results[0].suwa).not.toBeNull();
    });

    it('retains separate raw and Suwa result objects for a one-year interval', () => {
      const january2025 = new Date(2025, 0, 1);
      const january2026 = new Date(2026, 0, 1);
      const [result] = calculateHeightVelocityResults([
        { date: january2025, age: 5, height: 120 },
        { date: january2026, age: 6, height: 126 },
      ], 'male', SUWA_HV_BOYS);

      expect(result.raw?.startDate).toBe(january2025);
      expect(result.suwa?.startDate).toBe(january2025);
      expect(result.raw).not.toBe(result.suwa);
      expect(result.suwa?.sds).not.toBeNull();
    });

    it('should interpolate Suwa HV reference values and calculate HV-SDS', () => {
      const hvRef = interpolateHV(10.5, SUWA_HV_BOYS);
      expect(hvRef?.mean).toBeGreaterThan(0);
      expect(hvRef?.sd).toBeGreaterThan(0);

      const sds = calculateHVSDS(6.0, 10.5, 'male', SUWA_HV_BOYS);
      expect(sds).not.toBeNull();
      expect(typeof sds).toBe('number');

      // Table 3 prints "—" for mean and SD at age 0; this previously expected the placeholder mean 0 / SD 0.
      expect(interpolateHV(0, SUWA_HV_BOYS)).toBeNull();

      const overHV = interpolateHV(20, SUWA_HV_BOYS);
      expect(overHV?.mean).toBe(SUWA_HV_BOYS[SUWA_HV_BOYS.length - 1].mean);
    });
  });

  describe('Suwa HV-SDS reference availability', () => {
    const sexTables: Array<['male' | 'female', HVReferencePoint[]]> = [
      ['male', SUWA_HV_BOYS],
      ['female', SUWA_HV_GIRLS],
    ];

    describe.each(sexTables)('%s table where the source has no SD', (sex, table) => {
      it.each([0, 0.25, 0.5, 0.75, 0.76, 0.8, 0.875, 0.999999, 1 - Number.EPSILON / 2])('has no reference and no HV-SDS at %s years', (age) => {
        expect(interpolateHV(age, table)).toBeNull();
        expect(calculateHVSDS(15, age, sex, table)).toBeNull();
      });
    });

    it('does not interpolate the missing 0.75-year SD toward 1.0 years', () => {
      // The previous table treated the missing SD as 0: boys HV 15 gave about -41.10 at 0.76 and -6.26 at 0.80 years.
      expect(calculateHVSDS(15, 0.76, 'male', SUWA_HV_BOYS)).toBeNull();
      expect(calculateHVSDS(15, 0.8, 'male', SUWA_HV_BOYS)).toBeNull();
    });

    it('uses the 1.0-year table point itself although the preceding 0.75-year SD is missing', () => {
      expect(interpolateHV(1.0, SUWA_HV_BOYS)).toEqual({ mean: 13.9, sd: 1.55 });
      expect(interpolateHV(1.0, SUWA_HV_GIRLS)).toEqual({ mean: 13.4, sd: 1.4 });

      // Hand calculations from the printed values: (15 - 13.9) / 1.55 and (15 - 13.4) / 1.4.
      expect(calculateHVSDS(15, 1.0, 'male', SUWA_HV_BOYS)).toBeCloseTo(0.7096774193548384, 12);
      expect(calculateHVSDS(15, 1.0, 'female', SUWA_HV_GIRLS)).toBeCloseTo(1.1428571428571428, 12);
    });

    it('has a reference immediately after 1.0 years', () => {
      expect(interpolateHV(1.000001, SUWA_HV_BOYS)).not.toBeNull();
      expect(interpolateHV(1.000001, SUWA_HV_GIRLS)).not.toBeNull();
    });

    it('linearly interpolates between valid adjacent points (boys 1.125 years: mean 12.8, SD 1.365)', () => {
      const ref = interpolateHV(1.125, SUWA_HV_BOYS);

      expect(ref?.mean).toBeCloseTo(12.8, 10);
      expect(ref?.sd).toBeCloseTo(1.365, 10);
      expect(calculateHVSDS(15, 1.125, 'male', SUWA_HV_BOYS)).toBeCloseTo(2.2 / 1.365, 10);
    });

    it('uses the Table 3 values at 14.0 years (boys HV 5.5 gives -0.909, not the former -2.079)', () => {
      // (5.5 - 6.3) / 0.88
      expect(calculateHVSDS(5.5, 14.0, 'male', SUWA_HV_BOYS)).toBeCloseTo(-0.9090909090909091, 12);
    });

    it('uses the Table 3 values at 13.25, 14.0 and 16.0 years and at points either side of them', () => {
      // Hand calculations from printed Table 3 mean / SD: [age, HV, mean, SD]
      const cases: Array<[number, number, number, number]> = [
        [13.0, 11, 9.9, 1.45],
        [13.25, 11, 9.4, 1.45],
        [13.5, 11, 8.7, 1.23],
        [13.75, 9, 7.6, 1.01],
        [14.0, 7, 6.3, 0.88],
        [14.25, 7, 5.3, 0.8],
        [15.75, 3, 1.9, 0.58],
        [16.0, 3, 1.6, 0.53],
        [16.25, 3, 1.3, 0.49],
      ];

      cases.forEach(([age, velocity, mean, sd]) => {
        expect(calculateHVSDS(velocity, age, 'male', SUWA_HV_BOYS)).toBeCloseTo((velocity - mean) / sd, 10);
      });
    });

    it('interpolates between corrected boys rows (13.125 years: mean 9.65, SD 1.45; 16.125 years: mean 1.45, SD 0.51)', () => {
      expect(calculateHVSDS(12, 13.125, 'male', SUWA_HV_BOYS)).toBeCloseTo((12 - 9.65) / 1.45, 10);
      expect(calculateHVSDS(3, 16.125, 'male', SUWA_HV_BOYS)).toBeCloseTo((3 - 1.45) / 0.51, 10);
    });

    it('interpolates between valid girls rows (11.125 years: mean 8.15, SD 1.05)', () => {
      expect(calculateHVSDS(10, 11.125, 'female', SUWA_HV_GIRLS)).toBeCloseTo((10 - 8.15) / 1.05, 10);
    });

    it('still uses the final table point beyond the last table age', () => {
      expect(interpolateHV(17.5, SUWA_HV_BOYS)).toEqual({ mean: 0.3, sd: 0.3 });
      expect(interpolateHV(20, SUWA_HV_BOYS)).toEqual({ mean: 0.3, sd: 0.3 });
      expect(interpolateHV(17.25, SUWA_HV_GIRLS)).toEqual({ mean: 0.1, sd: 0.2 });
      expect(interpolateHV(17.5, SUWA_HV_GIRLS)).toEqual({ mean: 0.1, sd: 0.2 });
    });

    describe('with a small table containing missing values', () => {
      const table: HVReferencePoint[] = [
        { age: 1, mean: 10, sd: 1 },
        { age: 2, mean: 8, sd: null },
        { age: 3, mean: null, sd: 1 },
        { age: 4, mean: 6, sd: 2 },
        { age: 5, mean: 4, sd: 1 },
        { age: 6, mean: 0, sd: 1 },
        { age: 7, mean: 2, sd: 0 },
      ];

      it('uses a table point that exactly matches the age, even next to missing points', () => {
        expect(interpolateHV(1, table)).toEqual({ mean: 10, sd: 1 });
        expect(interpolateHV(4, table)).toEqual({ mean: 6, sd: 2 });
        expect(interpolateHV(5, table)).toEqual({ mean: 4, sd: 1 });
      });

      it('uses the nearest endpoint below the first table age', () => {
        expect(interpolateHV(0, table)).toEqual({ mean: 10, sd: 1 });
      });

      it('treats a missing mean, a missing SD, or an SD of 0 at the matching point as unavailable', () => {
        expect(interpolateHV(2, table)).toBeNull();
        expect(interpolateHV(3, table)).toBeNull();
        expect(interpolateHV(7, table)).toBeNull();
      });

      it('does not interpolate an interval with an unusable endpoint or reach a more distant point', () => {
        expect(interpolateHV(1.5, table)).toBeNull();
        expect(interpolateHV(2.5, table)).toBeNull();
        expect(interpolateHV(3.5, table)).toBeNull();
        expect(interpolateHV(6.5, table)).toBeNull();
        expect(interpolateHV(8, table)).toBeNull();
      });

      it('interpolates linearly between usable points and treats a mean of 0 as a value', () => {
        expect(interpolateHV(4.5, table)).toEqual({ mean: 5, sd: 1.5 });
        expect(interpolateHV(5.5, table)).toEqual({ mean: 2, sd: 1 });
        expect(interpolateHV(6, table)).toEqual({ mean: 0, sd: 1 });
        expect(calculateHVSDS(1, 6, 'male', table)).toBeCloseTo(1, 12);
      });

      it('accepts a negative velocity', () => {
        expect(calculateHVSDS(-1, 4.5, 'male', table)).toBeCloseTo(-4, 12);
      });
    });

    describe('with invalid input', () => {
      it('returns null for an empty table', () => {
        expect(interpolateHV(1, [])).toBeNull();
        expect(calculateHVSDS(5, 1, 'male', [])).toBeNull();
      });

      it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('returns null for non-finite age or velocity %s', (value) => {
        expect(interpolateHV(value, SUWA_HV_BOYS)).toBeNull();
        expect(calculateHVSDS(value, 5, 'male', SUWA_HV_BOYS)).toBeNull();
        expect(calculateHVSDS(15, value, 'male', SUWA_HV_BOYS)).toBeNull();
      });

      it('returns null for table points with non-finite values', () => {
        const table: HVReferencePoint[] = [
          { age: 1, mean: Number.NaN, sd: 1 },
          { age: 2, mean: 5, sd: Number.POSITIVE_INFINITY },
          { age: 3, mean: 5, sd: 1 },
        ];

        expect(interpolateHV(1, table)).toBeNull();
        expect(interpolateHV(1.5, table)).toBeNull();
        expect(interpolateHV(2, table)).toBeNull();
        expect(interpolateHV(2.5, table)).toBeNull();
        expect(interpolateHV(3, table)).toEqual({ mean: 5, sd: 1 });
      });

      it('returns null instead of Infinity when the interpolation or the SDS overflows', () => {
        const table: HVReferencePoint[] = [
          { age: 1, mean: -Number.MAX_VALUE, sd: 1 },
          { age: 2, mean: Number.MAX_VALUE, sd: 1 },
        ];

        expect(interpolateHV(1.5, table)).toBeNull();
        expect(calculateHVSDS(Number.MAX_VALUE, 5, 'male', SUWA_HV_BOYS)).toBeNull();
      });
    });

    describe('in height-velocity results', () => {
      it.each(sexTables)('keeps raw and Suwa HV but leaves HV-SDS null for a pair centred at 0.8 years (%s)', (sex, table) => {
        const [result] = calculateHeightVelocityResults([
          { date: new Date(2025, 0, 1), age: 0.3, height: 65 },
          { date: new Date(2026, 0, 1), age: 1.3, height: 80 },
        ], sex, table);

        expect(result.raw?.velocity).toBeCloseTo(15, 10);
        expect(result.suwa?.velocity).toBeCloseTo(15, 10);
        expect(result.suwa?.midpointAge).toBeCloseTo(0.8, 10);
        expect(result.suwa?.sds).toBeNull();
      });

      it('calculates HV-SDS for a pair centred exactly on 1.0 years', () => {
        const [result] = calculateHeightVelocityResults([
          { date: new Date(2025, 0, 1), age: 0.5, height: 65 },
          { date: new Date(2026, 0, 1), age: 1.5, height: 80 },
        ], 'male', SUWA_HV_BOYS);

        expect(result.suwa?.midpointAge).toBe(1);
        expect(result.suwa?.sds).toBeCloseTo(0.7096774193548384, 12);
      });

      it('calculates HV-SDS from the corrected boys table for a pair centred at 13.25 years', () => {
        const [result] = calculateHeightVelocityResults([
          { date: new Date(2025, 0, 1), age: 12.75, height: 150 },
          { date: new Date(2026, 0, 1), age: 13.75, height: 161 },
        ], 'male', SUWA_HV_BOYS);

        expect(result.suwa?.midpointAge).toBe(13.25);
        expect(result.suwa?.sds).toBeCloseTo((11 - 9.4) / 1.45, 10);
      });
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
    it('should accept only whole gestational days from 0 through 6', () => {
      expect(isValidGestationalDays(0)).toBe(true);
      expect(isValidGestationalDays(6)).toBe(true);
      expect(isValidGestationalDays(-1)).toBe(false);
      expect(isValidGestationalDays(7)).toBe(false);
      expect(isValidGestationalDays(1.5)).toBe(false);
      expect(isValidGestationalDays(Number.NaN)).toBe(false);
      expect(isValidGestationalDays(Infinity)).toBe(false);
      expect(isValidGestationalDays('3')).toBe(false);
    });

    it('accepts only finite integer gestational weeks', () => {
      [22, 35, 44, 0, 45].forEach((weeks) => expect(isValidGestationalWeeks(weeks)).toBe(true));
      [35.5, Number.NaN, Infinity, '35', null, undefined].forEach((weeks) => expect(isValidGestationalWeeks(weeks)).toBe(false));
    });

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

    it.each([0, 6])('calculates the correction for 35 weeks and %i days', (days) => {
      const birth = new Date('2020-01-01');
      const measure = new Date('2020-06-01');
      const expectedBirth = new Date(2020, 0, 1 + (40 - 35) * 7 - days);

      expect(calculateCorrectedAge(birth, measure, 35, days)).toBe(calculateDecimalAge(expectedBirth, measure));
    });

    it('should return null before the corrected 40w0d-equivalent date', () => {
      const birth = new Date('2020-01-01');
      const beforeCorrectedBirth = new Date('2020-02-25');

      expect(calculateCorrectedAge(birth, beforeCorrectedBirth, 32, 0)).toBeNull();
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

    it('should apply correction at exactly 3 years old but not after the boundary', () => {
      const birth = new Date('2020-01-01');
      const exactlyThree = new Date('2023-01-01');
      const justOverThree = new Date('2023-01-02');

      expect(calculateCorrectedAge(birth, exactlyThree, 32, 0)).not.toBe(calculateDecimalAge(birth, exactlyThree));
      expect(calculateCorrectedAge(birth, justOverThree, 32, 0)).toBe(calculateDecimalAge(birth, justOverThree));
    });

    it('should preserve a corrected age of zero and fail closed for invalid gestational days', () => {
      const birth = new Date('2020-01-01');
      const correctedBirthDate = new Date('2020-02-12');

      expect(calculateCorrectedAge(birth, correctedBirthDate, 34, 0)).toBe(0);
      [-1, 7, 1.5, Number.NaN, Infinity].forEach((days) => {
        expect(calculateCorrectedAge(birth, correctedBirthDate, 34, days)).toBeNull();
      });
    });

    it.each([Number.NaN, Infinity, 35.5, '35', null])('rejects invalid gestational weeks: %j', (weeks) => {
      const birth = new Date('2020-01-01');
      const measure = new Date('2020-06-01');

      expect(calculateCorrectedAge(birth, measure, weeks, 0)).toBeNull();
      expect(getCorrectedBirthDate(birth, weeks, 0)).toBeNull();
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

    it('should not generate a corrected birth date for invalid gestational days', () => {
      const birth = new Date('2020-01-01');
      [-1, 7, 1.5, Number.NaN, Infinity].forEach((days) => {
        expect(getCorrectedBirthDate(birth, 34, days)).toBeNull();
      });
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
