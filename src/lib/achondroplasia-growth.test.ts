import { describe, expect, it } from 'vitest';
import {
  ACHONDROPLASIA_MAX_COMPLETED_MONTHS,
  achondroplasiaHeightAtZ,
  achondroplasiaWeightAtZ,
  calculateAchondroplasiaHeightSDS,
  calculateAchondroplasiaWeightSDS,
  getAchondroplasiaSdLine,
  resolveAchondroplasiaReference,
} from './achondroplasia-growth';
import { ACHONDROPLASIA_CLARITY_BOYS, ACHONDROPLASIA_CLARITY_GIRLS } from '../data/achondroplasia-clarity-data';
import { ACHONDROPLASIA_CLARITY_CSV_ROWS } from '../data/achondroplasia-clarity-source-fixture';

// Expected values below come from the original CSV cells (via the source fixture) and plain arithmetic.
// They are never computed with the production SDS or line functions.
const csv = (sex: 0 | 1, month: number) => {
  const row = ACHONDROPLASIA_CLARITY_CSV_ROWS.find(r => r[0] === sex && r[1] === month);
  if (!row) throw new Error(`no CSV row for sex ${sex} month ${month}`);
  const [, , htMean, htSd, wtMean, wtLower, wtUpper] = row;
  return { htMean, htSd, wtMean, wtLower, wtUpper };
};
const SEX_CODE = { male: 0, female: 1 } as const;
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const SEXES = ['male', 'female'] as const;
const tableOf = (sex: 'male' | 'female') => (sex === 'male' ? ACHONDROPLASIA_CLARITY_BOYS : ACHONDROPLASIA_CLARITY_GIRLS);

describe('resolveAchondroplasiaReference: age limit and completed-month row', () => {
  it('uses the completed-month row, with no interpolation inside a month', () => {
    const birth = d(2020, 1, 15);
    const lastDayOfMonth0 = resolveAchondroplasiaReference(birth, d(2020, 2, 14), 'male');
    const firstDayOfMonth1 = resolveAchondroplasiaReference(birth, d(2020, 2, 15), 'male');
    expect(lastDayOfMonth0.status === 'ok' && lastDayOfMonth0.completedMonths).toBe(0);
    expect(firstDayOfMonth1.status === 'ok' && firstDayOfMonth1.completedMonths).toBe(1);
    // Same row for the whole month
    const midMonth = resolveAchondroplasiaReference(birth, d(2020, 5, 30), 'male');
    const monthStart = resolveAchondroplasiaReference(birth, d(2020, 5, 15), 'male');
    expect(midMonth.status === 'ok' && midMonth.row).toBe(monthStart.status === 'ok' && monthStart.row);
  });

  it('follows the app-wide completed-month rule for month-end births (date-fns differenceInMonths)', () => {
    const birth = d(2020, 1, 31);
    const months = (m: Date) => {
      const r = resolveAchondroplasiaReference(birth, m, 'male');
      return r.status === 'ok' ? r.completedMonths : r.status;
    };
    expect(months(d(2020, 2, 28))).toBe(1);
    expect(months(d(2020, 2, 29))).toBe(1);
    expect(months(d(2020, 3, 30))).toBe(1);
    expect(months(d(2020, 3, 31))).toBe(2);
  });

  it('follows the same rule for a leap-day birth', () => {
    const birth = d(2020, 2, 29);
    const months = (m: Date) => {
      const r = resolveAchondroplasiaReference(birth, m, 'female');
      return r.status === 'ok' ? r.completedMonths : r.status;
    };
    expect(months(d(2020, 3, 28))).toBe(0);
    expect(months(d(2020, 3, 29))).toBe(1);
    expect(months(d(2021, 2, 27))).toBe(11);
    expect(months(d(2021, 2, 28))).toBe(12);
  });

  it('includes exactly 18.0 years and excludes the next day, without reusing the last row', () => {
    const birth = d(2002, 1, 1);
    const at18 = resolveAchondroplasiaReference(birth, d(2020, 1, 1), 'male');
    expect(at18.status).toBe('ok');
    expect(at18.status === 'ok' && at18.completedMonths).toBe(216);
    expect(at18.status === 'ok' && at18.referenceAge).toBe(18);
    expect(at18.status === 'ok' && at18.row).toBe(ACHONDROPLASIA_CLARITY_BOYS[216]);

    const next = resolveAchondroplasiaReference(birth, d(2020, 1, 2), 'male');
    expect(next.status).toBe('out-of-range');
    expect(next).not.toHaveProperty('row');

    const before = resolveAchondroplasiaReference(birth, d(2019, 12, 31), 'male');
    expect(before.status === 'ok' && before.completedMonths).toBe(215);
  });

  it('treats the 18th anniversary of a leap-day birth (Feb 28 in a non-leap year) as exactly 18.0', () => {
    const birth = d(2004, 2, 29);
    expect(resolveAchondroplasiaReference(birth, d(2022, 2, 28), 'female').status).toBe('ok');
    expect(resolveAchondroplasiaReference(birth, d(2022, 3, 1), 'female').status).toBe('out-of-range');
  });

  it('is unavailable (not out of range, not row 0) before the reference birth date or for invalid dates', () => {
    expect(resolveAchondroplasiaReference(d(2020, 1, 1), d(2019, 12, 31), 'male').status).toBe('unavailable');
    expect(resolveAchondroplasiaReference(new Date(Number.NaN), d(2020, 1, 1), 'male').status).toBe('unavailable');
    expect(resolveAchondroplasiaReference(d(2020, 1, 1), new Date(Number.NaN), 'male').status).toBe('unavailable');
  });

  it('accepts a measurement on the birth date as month 0 (age exactly 0)', () => {
    const r = resolveAchondroplasiaReference(d(2020, 1, 1), d(2020, 1, 1), 'female');
    expect(r.status === 'ok' && r.completedMonths).toBe(0);
    expect(r.status === 'ok' && r.referenceAge).toBe(0);
  });

  it('exposes the limit as 216 completed months', () => {
    expect(ACHONDROPLASIA_MAX_COMPLETED_MONTHS).toBe(216);
  });
});

describe('height SDS: (height - ht mean) / htsd with the common SD', () => {
  it.each(SEXES)('gives 0, +-1 and +-2 at mean and mean +- k*htsd for every month (%s)', sex => {
    for (const row of tableOf(sex)) {
      const { htMean, htSd } = csv(SEX_CODE[sex], row[0]);
      for (const k of [-2, -1, 0, 1, 2]) {
        expect(calculateAchondroplasiaHeightSDS(htMean + k * htSd, row)).toBeCloseTo(k, 9);
      }
    }
  });

  it('matches fixed values derived from the CSV (male month 0, male 12, male 216, female 0, 60, 216)', () => {
    expect(calculateAchondroplasiaHeightSDS(62.77, ACHONDROPLASIA_CLARITY_BOYS[0])).toBeCloseTo(3.0924901024406, 9);
    expect(calculateAchondroplasiaHeightSDS(71.9, ACHONDROPLASIA_CLARITY_BOYS[12])).toBeCloseTo(3.07653137549157, 9);
    expect(calculateAchondroplasiaHeightSDS(139, ACHONDROPLASIA_CLARITY_BOYS[216])).toBeCloseTo(1.5994916456939, 9);
    expect(calculateAchondroplasiaHeightSDS(61.5, ACHONDROPLASIA_CLARITY_GIRLS[0])).toBeCloseTo(3.29011510558105, 9);
    expect(calculateAchondroplasiaHeightSDS(97.05, ACHONDROPLASIA_CLARITY_GIRLS[60])).toBeCloseTo(2.18564577473808, 9);
    expect(calculateAchondroplasiaHeightSDS(133.68, ACHONDROPLASIA_CLARITY_GIRLS[216])).toBeCloseTo(1.89992576576475, 9);
  });

  it('returns exactly 0 at the mean (a valid SDS, not "unavailable")', () => {
    expect(calculateAchondroplasiaHeightSDS(52.76956881, ACHONDROPLASIA_CLARITY_BOYS[0])).toBe(0);
  });

  it('is not calculable for non-positive, non-finite or non-numeric heights', () => {
    const row = ACHONDROPLASIA_CLARITY_BOYS[12];
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '70' as unknown as number]) {
      expect(calculateAchondroplasiaHeightSDS(bad, row)).toBeNull();
    }
  });

  it('is not calculable when the reference SD is not positive or finite', () => {
    expect(calculateAchondroplasiaHeightSDS(70, [12, 60, 0, 7, 1, 1])).toBeNull();
    expect(calculateAchondroplasiaHeightSDS(70, [12, 60, -1, 7, 1, 1])).toBeNull();
    expect(calculateAchondroplasiaHeightSDS(70, [12, 60, Number.NaN, 7, 1, 1])).toBeNull();
    expect(calculateAchondroplasiaHeightSDS(70, [12, Number.NaN, 3, 7, 1, 1])).toBeNull();
  });
});

describe('weight SDS: upper SD above the mean, lower SD at or below it (Hoover-Fong 2021, Methods)', () => {
  it.each(SEXES)('gives -2, -1 on the lower side and +1, +2 on the upper side, 0 at the mean (%s)', sex => {
    for (const row of tableOf(sex)) {
      const { wtMean, wtLower, wtUpper } = csv(SEX_CODE[sex], row[0]);
      expect(calculateAchondroplasiaWeightSDS(wtMean, row)).toBe(0);
      for (const k of [1, 2]) {
        expect(calculateAchondroplasiaWeightSDS(wtMean + k * wtUpper, row)).toBeCloseTo(k, 9);
        expect(calculateAchondroplasiaWeightSDS(wtMean - k * wtLower, row)).toBeCloseTo(-k, 9);
      }
    }
  });

  it('uses different SDs on each side of the mean (an asymmetric reference)', () => {
    const row = ACHONDROPLASIA_CLARITY_BOYS[216]; // lower 8.67..., upper 16.09...
    const { wtMean, wtLower, wtUpper } = csv(0, 216);
    expect(wtUpper).not.toBe(wtLower);
    const delta = 5;
    expect(calculateAchondroplasiaWeightSDS(wtMean + delta, row)).toBeCloseTo(delta / wtUpper, 12);
    expect(calculateAchondroplasiaWeightSDS(wtMean - delta, row)).toBeCloseTo(-delta / wtLower, 12);
  });

  it('matches fixed values derived from the CSV', () => {
    expect(calculateAchondroplasiaWeightSDS(4.22, ACHONDROPLASIA_CLARITY_BOYS[0])).toBeCloseTo(-0.496696818030665, 9);
    expect(calculateAchondroplasiaWeightSDS(5.91, ACHONDROPLASIA_CLARITY_BOYS[0])).toBeCloseTo(1.49406007369448, 9);
    expect(calculateAchondroplasiaWeightSDS(6.71, ACHONDROPLASIA_CLARITY_BOYS[12])).toBeCloseTo(-0.50220819014147, 9);
    expect(calculateAchondroplasiaWeightSDS(9.15, ACHONDROPLASIA_CLARITY_BOYS[12])).toBeCloseTo(1.49764778590863, 9);
    expect(calculateAchondroplasiaWeightSDS(46.77, ACHONDROPLASIA_CLARITY_BOYS[216])).toBeCloseTo(-0.499911093236306, 9);
    expect(calculateAchondroplasiaWeightSDS(75.25, ACHONDROPLASIA_CLARITY_BOYS[216])).toBeCloseTo(1.49973606098998, 9);
    expect(calculateAchondroplasiaWeightSDS(3.83, ACHONDROPLASIA_CLARITY_GIRLS[0])).toBeCloseTo(-0.500628768283491, 9);
    expect(calculateAchondroplasiaWeightSDS(5.16, ACHONDROPLASIA_CLARITY_GIRLS[0])).toBeCloseTo(1.50342353403837, 9);
    expect(calculateAchondroplasiaWeightSDS(14.28, ACHONDROPLASIA_CLARITY_GIRLS[60])).toBeCloseTo(-0.500910644242794, 9);
    expect(calculateAchondroplasiaWeightSDS(18.39, ACHONDROPLASIA_CLARITY_GIRLS[60])).toBeCloseTo(1.50208316001434, 9);
    expect(calculateAchondroplasiaWeightSDS(46.13, ACHONDROPLASIA_CLARITY_GIRLS[216])).toBeCloseTo(-0.50007105029667, 9);
    expect(calculateAchondroplasiaWeightSDS(70.49, ACHONDROPLASIA_CLARITY_GIRLS[216])).toBeCloseTo(1.49964872248479, 9);
  });

  it('is not calculable for non-positive or non-finite weights', () => {
    const row = ACHONDROPLASIA_CLARITY_BOYS[12];
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(calculateAchondroplasiaWeightSDS(bad, row)).toBeNull();
    }
  });

  it('checks only the SD of the side actually used (upper above the mean, lower at or below it)', () => {
    expect(calculateAchondroplasiaWeightSDS(6, [12, 60, 3, 7, 0, 1])).toBeNull(); // below mean, lower SD 0
    expect(calculateAchondroplasiaWeightSDS(8, [12, 60, 3, 7, 0, 1])).toBeCloseTo(1, 12); // above mean, upper SD 1
    expect(calculateAchondroplasiaWeightSDS(8, [12, 60, 3, 7, 1, Number.NaN])).toBeNull(); // above mean, upper SD NaN
    expect(calculateAchondroplasiaWeightSDS(6, [12, 60, 3, 7, 2, Number.NaN])).toBeCloseTo(-0.5, 12); // below mean, upper SD unused
  });

  it('gives 0 for a weight equal to the mean when the lower SD is usable, whatever the upper SD is', () => {
    expect(calculateAchondroplasiaWeightSDS(7, [12, 60, 3, 7, 2, 5])).toBe(0);
    expect(calculateAchondroplasiaWeightSDS(7, [12, 60, 3, 7, 2, 0])).toBe(0);
    expect(calculateAchondroplasiaWeightSDS(7, [12, 60, 3, 7, 2, Number.NaN])).toBe(0);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'is not calculable for a weight equal to the mean when the lower SD is %s',
    lowerSd => {
      expect(calculateAchondroplasiaWeightSDS(7, [12, 60, 3, 7, lowerSd, 5])).toBeNull();
    },
  );
});

describe('background SD lines use the same columns as the SDS', () => {
  it.each(SEXES)('height lines equal ht mean + z * htsd for z = -3, -2.5, -2, -1, 0, 1, 2 at each completed month (%s)', sex => {
    for (const z of [-3, -2.5, -2, -1, 0, 1, 2]) {
      const line = getAchondroplasiaSdLine(sex, 'height', z);
      expect(line).toHaveLength(217);
      line.forEach((p, month) => {
        const { htMean, htSd } = csv(SEX_CODE[sex], month);
        expect(p.age).toBe(month / 12);
        expect(p.value).toBeCloseTo(htMean + z * htSd, 9);
      });
    }
  });

  it.each(SEXES)('weight lines use the lower SD below the mean, the upper SD above it, and the mean at z = 0 (%s)', sex => {
    for (const z of [-3, -2.5, -2, -1, 0, 1, 2]) {
      const line = getAchondroplasiaSdLine(sex, 'weight', z);
      expect(line).toHaveLength(217);
      line.forEach((p, month) => {
        const { wtMean, wtLower, wtUpper } = csv(SEX_CODE[sex], month);
        const expected = z === 0 ? wtMean : z > 0 ? wtMean + z * wtUpper : wtMean + z * wtLower;
        expect(p.value).toBeCloseTo(expected, 9);
      });
    }
  });

  it('matches fixed line values derived from the CSV (male month 0 and 216, female month 60)', () => {
    const at = (sex: 'male' | 'female', ind: 'height' | 'weight', z: number, month: number) =>
      getAchondroplasiaSdLine(sex, ind, z)[month].value;
    expect(at('male', 'height', -3, 0)).toBeCloseTo(43.06823022, 8);
    expect(at('male', 'height', -2.5, 0)).toBeCloseTo(44.685119985, 8);
    expect(at('male', 'height', 2, 0)).toBeCloseTo(59.23712787, 8);
    expect(at('male', 'weight', -3, 0)).toBeCloseTo(1.629809753, 8);
    expect(at('male', 'weight', -2.5, 0)).toBeCloseTo(2.147164236, 8);
    expect(at('male', 'weight', 2, 0)).toBeCloseTo(6.308255341, 8);
    expect(at('male', 'height', -3, 216)).toBeCloseTo(110.231686982, 8);
    expect(at('male', 'weight', -3, 216)).toBeCloseTo(25.077417183, 8);
    expect(at('male', 'weight', 2, 216)).toBeCloseTo(83.30313482, 8);
    expect(at('female', 'height', -2.5, 60)).toBeCloseTo(75.6079885, 8);
    expect(at('female', 'weight', -2.5, 60)).toBeCloseTo(10.2099817875, 8);
    expect(at('female', 'weight', 1, 60)).toBeCloseTo(17.35708362, 8);
  });

  it.each(SEXES)('are finite, positive for weight, and strictly ordered -3 < -2.5 < -2 < -1 < 0 < 1 < 2 at every month (%s)', sex => {
    const zs = [-3, -2.5, -2, -1, 0, 1, 2];
    for (const indicator of ['height', 'weight'] as const) {
      const lines = zs.map(z => getAchondroplasiaSdLine(sex, indicator, z));
      for (let month = 0; month <= 216; month++) {
        const values = lines.map(l => l[month].value);
        expect(values.every(v => Number.isFinite(v))).toBe(true);
        expect(values[0]).toBeGreaterThan(0);
        for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    }
  });

  it('round-trips: the SDS of a line value is the line z (same columns for the SDS and the lines)', () => {
    for (const sex of SEXES) {
      for (const row of tableOf(sex)) {
        for (const z of [-3, -2.5, -2, -1, 1, 2]) {
          const h = achondroplasiaHeightAtZ(z, row);
          const w = achondroplasiaWeightAtZ(z, row);
          expect(calculateAchondroplasiaHeightSDS(h as number, row)).toBeCloseTo(z, 9);
          expect(calculateAchondroplasiaWeightSDS(w as number, row)).toBeCloseTo(z, 9);
        }
      }
    }
  });

  it('omits non-finite points instead of drawing them', () => {
    expect(achondroplasiaHeightAtZ(Number.NaN, ACHONDROPLASIA_CLARITY_BOYS[0])).toBeNull();
    expect(achondroplasiaHeightAtZ(1, [0, 50, 0, 3, 1, 1])).toBeNull();
    expect(achondroplasiaWeightAtZ(-1, [0, 50, 3, 3, 0, 1])).toBeNull();
    expect(achondroplasiaWeightAtZ(1, [0, 50, 3, 3, 0, 1])).toBe(4);
    expect(achondroplasiaWeightAtZ(0, [0, 50, 3, 3, 0, 0])).toBe(3);
  });
});
