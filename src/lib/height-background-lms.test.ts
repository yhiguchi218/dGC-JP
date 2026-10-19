import { describe, expect, it } from 'vitest';
import { HEIGHT_BOYS_LMS, HEIGHT_GIRLS_LMS, WEIGHT_BOYS_LMS } from '../data/growth-data';
import { FUHYO_BOYS_HEIGHT } from '../data/fuhyo-growth-data';
import { ISOJIMA_2016_TABLE2_HEIGHT_ROWS as SOURCE_ROWS } from '../data/isojima-height-lms-source-fixture';
import {
  calculateHeightVelocity,
  calculateMeasurementFromZ,
  calculateMonthlyHeightSDS,
  calculateWeightSDSByCompletedMonths,
  calculateZScore,
  interpolateLMS,
} from './growth-utils';

const EXPECTED_AGES = [
  ...[0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
  ...Array.from({ length: 31 }, (_, i) => 2.5 + i * 0.5),
];

describe('Isojima 2016 Table 2 height LMS (background curves)', () => {
  // Comparison with the transcription of the published table (not an independent calculation).
  describe('table transcription', () => {
    it('has 40 ascending, non-duplicated ages in each sex table', () => {
      for (const table of [HEIGHT_BOYS_LMS, HEIGHT_GIRLS_LMS]) {
        expect(table.map(p => p.age)).toEqual(EXPECTED_AGES);
      }
      expect(SOURCE_ROWS.map(r => r[0])).toEqual(EXPECTED_AGES);
    });

    it('matches all 240 transcribed cells (age, L, M, S for boys and girls)', () => {
      SOURCE_ROWS.forEach((row, i) => {
        const [age, bL, bM, bS, gL, gM, gS] = row;
        expect(HEIGHT_BOYS_LMS[i]).toEqual({ age, L: bL, M: bM, S: bS });
        expect(HEIGHT_GIRLS_LMS[i]).toEqual({ age, L: gL, M: gM, S: gS });
      });
    });

    it('keeps the published signs of L, including exactly 0 for boys at 17.5 years', () => {
      const boys = (age: number) => HEIGHT_BOYS_LMS.find(p => p.age === age)!.L;
      const girls = (age: number) => HEIGHT_GIRLS_LMS.find(p => p.age === age)!.L;
      expect(boys(0)).toBeGreaterThan(0);
      expect(boys(6.5)).toBeGreaterThan(0);
      expect(boys(7)).toBeLessThan(0);
      expect(boys(12)).toBeLessThan(0);
      expect(boys(12.5)).toBeGreaterThan(0);
      expect(boys(15)).toBeLessThan(0);
      expect(Object.is(boys(17.5), 0)).toBe(true);
      expect(girls(7.5)).toBeLessThan(0);
      expect(girls(8.5)).toBeLessThan(0);
      expect(girls(9)).toBeGreaterThan(0);
      expect(girls(17.5)).toBeGreaterThan(0);
      // The only exact zero among all 80 L values is boys 17.5 years.
      const zeros = [...HEIGHT_BOYS_LMS, ...HEIGHT_GIRLS_LMS].filter(p => p.L === 0);
      expect(zeros).toHaveLength(1);
    });
  });

  // Expected heights were calculated outside the app (scripts/height-lms-independent-check.ts)
  // from the Table 2 values using M(1+LSz)^(1/L), or M*exp(Sz) when L = 0.
  describe('inverse LMS at table ages', () => {
    const z: Record<string, number> = { '-3': 0, '-2.5': 1, '-2': 2, '-1': 3, '0': 4, '1': 5, '2': 6 };
    const cases: Array<[string, typeof HEIGHT_BOYS_LMS, number, number[]]> = [
      ['boys 0', HEIGHT_BOYS_LMS, 0, [42.2793729625, 43.4942449742, 44.6665294957, 46.8983619154, 49, 50.9905281564, 52.8848349804]],
      ['boys 5.5', HEIGHT_BOYS_LMS, 5.5, [97.0799081623, 99.1780698511, 101.304756448, 105.644354653, 110.1, 114.67298443, 119.364594705]],
      ['boys 11', HEIGHT_BOYS_LMS, 11, [124.667846885, 127.200680927, 129.860689751, 135.605103405, 142, 149.170286222, 157.276195867]],
      ['boys 14', HEIGHT_BOYS_LMS, 14, [141.404769398, 145.040494322, 148.688565512, 156.020867626, 163.4, 170.824408446, 178.292647237]],
      ['boys 15', HEIGHT_BOYS_LMS, 15, [149.538169448, 152.312926681, 155.158708303, 161.072737765, 167.3, 173.861870875, 180.781521189]],
      ['boys 17.5 (L=0)', HEIGHT_BOYS_LMS, 17.5, [154.237447425, 156.881898176, 159.571688887, 165.090412992, 170.8, 176.707050829, 182.818394688]],
      ['girls 0', HEIGHT_GIRLS_LMS, 0, [42.7551805045, 43.7229032204, 44.6863606218, 46.6009853836, 48.5, 50.3842541029, 52.2545152458]],
      ['girls 8', HEIGHT_GIRLS_LMS, 8, [109.247762732, 111.579241704, 113.966284464, 118.912956643, 124.1, 129.540354192, 135.24772392]],
      ['girls 12', HEIGHT_GIRLS_LMS, 12, [129.972859798, 133.560606781, 137.037175944, 143.692617707, 150, 156.006529009, 161.749704779]],
      ['girls 17.5', HEIGHT_GIRLS_LMS, 17.5, [142.945517191, 145.447174999, 147.938121144, 152.88894404, 157.8, 162.673131978, 167.510032134]],
    ];

    it.each(cases)('%s matches independently calculated heights at SDS -3 to +2', (_label, table, age, expected) => {
      const lms = interpolateLMS(age, table);
      for (const [sds, idx] of Object.entries(z)) {
        expect(calculateMeasurementFromZ(Number(sds), lms)).toBeCloseTo(expected[idx], 7);
      }
    });

    it.each(cases)('%s returns M at SDS 0 and computes the -2.5 and -3 lines', (_label, table, age, expected) => {
      const lms = interpolateLMS(age, table);
      expect(calculateMeasurementFromZ(0, lms)).toBe(lms.M);
      expect(calculateMeasurementFromZ(-2.5, lms)).toBeCloseTo(expected[1], 7);
      expect(calculateMeasurementFromZ(-3, lms)).toBeCloseTo(expected[0], 7);
    });
  });

  describe('rendering ages and lines', () => {
    const levels = [-3, -2.5, -2, -1, 0, 1, 2];

    // Includes the sign-change intervals of L (boys 6.5-7, 12-12.5, 14.5-15, 17-17.5; girls 7-7.5, 8.5-9).
    it.each([['boys', HEIGHT_BOYS_LMS], ['girls', HEIGHT_GIRLS_LMS]] as const)(
      '%s lines are finite and strictly ordered at every age from 0 to 18 in 0.01-year steps',
      (_sex, table) => {
        for (let k = 0; k <= 1800; k++) {
          const age = k / 100;
          const lms = interpolateLMS(age, table);
          expect(Number.isFinite(lms.L) && Number.isFinite(lms.M) && Number.isFinite(lms.S)).toBe(true);
          const values = levels.map(sds => calculateMeasurementFromZ(sds, lms));
          values.forEach(v => expect(Number.isFinite(v) && v > 0).toBe(true));
          for (let i = 1; i < values.length; i++) {
            expect(values[i]).toBeGreaterThan(values[i - 1]);
          }
        }
      }
    );

    it('handles L exactly 0 and small published-scale L without NaN or Infinity', () => {
      for (const L of [0, 1e-6, -1e-6, 0.015, -0.042]) {
        const values = levels.map(sds => calculateMeasurementFromZ(sds, { age: 0, L, M: 170, S: 0.034 }));
        values.forEach(v => expect(Number.isFinite(v)).toBe(true));
        expect(values[4]).toBe(170);
        // Small L must agree with the L = 0 exponential form.
        if (Math.abs(L) <= 1e-6) {
          expect(values[0]).toBeCloseTo(170 * Math.exp(-3 * 0.034), 3);
        }
      }
    });

    it('keeps interpolation outside the table at the end rows', () => {
      expect(interpolateLMS(-1, HEIGHT_BOYS_LMS).L).toBe(2.3);
      expect(interpolateLMS(20, HEIGHT_BOYS_LMS).L).toBe(0);
      expect(interpolateLMS(20, HEIGHT_GIRLS_LMS).M).toBe(157.8);
    });
  });

  describe('unchanged behavior outside the background curves', () => {
    it('keeps height SDS on 附表1 mean and SD, not on the LMS reference', () => {
      const birth = new Date(2020, 0, 1);
      const at12Months = new Date(2021, 0, 1);
      const [mean, sd] = FUHYO_BOYS_HEIGHT[12];
      const height = mean + 2 * sd;

      const sds = calculateMonthlyHeightSDS(height, birth, at12Months, FUHYO_BOYS_HEIGHT);
      expect(sds).toBeCloseTo(2, 10);

      // The same height on the Isojima LMS (age 1.0) is a different SDS; the two references are not forced to agree.
      const lmsSds = calculateZScore(height, interpolateLMS(1, HEIGHT_BOYS_LMS));
      expect(Math.abs(lmsSds - 2)).toBeGreaterThan(0.1);
    });

    it('keeps the weight LMS table and weight SDS', () => {
      expect(WEIGHT_BOYS_LMS[4]).toEqual({ age: 1, L: -0.062, M: 9.38, S: 0.105 });
      const sds = calculateWeightSDSByCompletedMonths(9.38, new Date(2020, 0, 1), new Date(2021, 0, 1), WEIGHT_BOYS_LMS);
      expect(sds).toBeCloseTo(0, 10);
    });

    it('keeps raw height velocity independent of the height LMS', () => {
      expect(calculateHeightVelocity(75, 1, 85, 2)).toEqual({ velocity: 10, midpointAge: 1.5 });
    });
  });
});
